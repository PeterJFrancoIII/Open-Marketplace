import type { SocialConnection, SocialProvider } from "../types.ts";
import {
  assertNoSecretsInPublicPayload,
  hashProviderSubject,
  openTokenBundle,
  parseEncryptionKey,
  sealTokenBundle,
} from "./crypto.ts";
import {
  applyProviderClaimsToConnection,
  nextRefreshBackoffSeconds,
} from "./normalize.ts";
import { createPkcePair, sessionExpiry } from "./pkce.ts";
import type {
  OAuthSession,
  PublicGrantView,
  SocialIdentityAdapter,
  StoredProviderGrant,
} from "./types.ts";
import { OAuthError } from "./types.ts";

export type OAuthSessionStore = {
  put(session: OAuthSession): Promise<void>;
  take(state: string): Promise<OAuthSession | null>;
};

export type ProviderGrantStore = {
  upsert(grant: StoredProviderGrant): Promise<void>;
  getById(id: string): Promise<StoredProviderGrant | null>;
  listForProfile(profileId: string): Promise<StoredProviderGrant[]>;
  getForProfileProvider(
    profileId: string,
    provider: SocialProvider,
  ): Promise<StoredProviderGrant | null>;
  getActive(profileId: string, provider: SocialProvider): Promise<StoredProviderGrant | null>;
};

export function createMemoryOAuthSessionStore(): OAuthSessionStore {
  const byState = new Map<string, OAuthSession>();
  return {
    async put(session) {
      byState.set(session.state, session);
    },
    async take(state) {
      const session = byState.get(state) ?? null;
      if (session) byState.delete(state);
      return session;
    },
  };
}

export function createMemoryProviderGrantStore(): ProviderGrantStore {
  const byId = new Map<string, StoredProviderGrant>();
  return {
    async upsert(grant) {
      byId.set(grant.id, grant);
    },
    async getById(id) {
      return byId.get(id) ?? null;
    },
    async listForProfile(profileId) {
      return [...byId.values()].filter((g) => g.profileId === profileId);
    },
    async getForProfileProvider(profileId, provider) {
      return (
        [...byId.values()].find(
          (g) => g.profileId === profileId && g.provider === provider,
        ) ?? null
      );
    },
    async getActive(profileId, provider) {
      const row = await this.getForProfileProvider(profileId, provider);
      return row?.status === "active" ? row : null;
    },
  };
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function toPublicGrant(grant: StoredProviderGrant): PublicGrantView {
  const view: PublicGrantView = {
    id: grant.id,
    profileId: grant.profileId,
    provider: grant.provider,
    status: grant.status,
    grantedScopes: [...grant.grantedScopes],
    expiresAt: grant.expiresAt,
    nextRefreshAt: grant.nextRefreshAt,
    connectedAt: grant.createdAt,
    revokedAt: grant.revokedAt,
  };
  assertNoSecretsInPublicPayload(view);
  return view;
}

export type OAuthService = {
  begin(input: {
    profileId: string;
    provider: SocialProvider;
    redirectUri: string;
    returnTo: string;
    now?: Date;
  }): Promise<{ authorizationUrl: string; state: string }>;
  complete(input: {
    provider: SocialProvider;
    code: string;
    state: string;
    now?: Date;
    existingConnection?: SocialConnection | null;
  }): Promise<{
    grant: PublicGrantView;
    connection: SocialConnection;
    claimsOmitted: string[];
    returnTo: string;
  }>;
  refresh(input: {
    profileId: string;
    provider: SocialProvider;
    connection: SocialConnection;
    now?: Date;
  }): Promise<{
    grant: PublicGrantView;
    connection: SocialConnection;
    claimsOmitted: string[];
  }>;
  disconnect(input: {
    profileId: string;
    provider: SocialProvider;
    connection: SocialConnection;
    now?: Date;
  }): Promise<{ grant: PublicGrantView | null; connection: SocialConnection }>;
  listPublicGrants(profileId: string): Promise<PublicGrantView[]>;
};

export function createOAuthService(deps: {
  adapters: Partial<Record<SocialProvider, SocialIdentityAdapter>>;
  sessions: OAuthSessionStore;
  grants: ProviderGrantStore;
  encryptionKey: Uint8Array | string;
}): OAuthService {
  const key =
    typeof deps.encryptionKey === "string"
      ? parseEncryptionKey(deps.encryptionKey)
      : deps.encryptionKey;

  function adapterFor(provider: SocialProvider): SocialIdentityAdapter {
    const adapter = deps.adapters[provider];
    if (!adapter) {
      throw new OAuthError(`OAuth provider ${provider} is not configured`, 503);
    }
    return adapter;
  }

  return {
    async begin(input) {
      const adapter = adapterFor(input.provider);
      const pkce = await createPkcePair();
      const now = input.now ?? new Date();
      const session: OAuthSession = {
        state: pkce.state,
        profileId: input.profileId,
        provider: input.provider,
        codeVerifier: pkce.codeVerifier,
        redirectUri: input.redirectUri,
        returnTo: input.returnTo,
        nonce: pkce.nonce,
        createdAt: now.toISOString(),
        expiresAt: sessionExpiry(now),
      };
      await deps.sessions.put(session);
      const url = await adapter.beginAuthorization({
        state: pkce.state,
        codeChallenge: pkce.codeChallenge,
        redirectUri: input.redirectUri,
        nonce: pkce.nonce,
      });
      const result = { authorizationUrl: url.toString(), state: pkce.state };
      assertNoSecretsInPublicPayload(result);
      return result;
    },

    async complete(input) {
      const now = input.now ?? new Date();
      const session = await deps.sessions.take(input.state);
      if (!session) throw new OAuthError("Unknown or reused OAuth state", 400);
      if (session.provider !== input.provider) {
        throw new OAuthError("OAuth provider mismatch", 400);
      }
      if (new Date(session.expiresAt).getTime() < now.getTime()) {
        throw new OAuthError("OAuth session expired", 400);
      }

      const adapter = adapterFor(input.provider);
      const tokens = await adapter.exchangeAuthorizationCode({
        code: input.code,
        codeVerifier: session.codeVerifier,
        redirectUri: session.redirectUri,
      });
      const claims = await adapter.refreshPublicClaims(tokens);
      if (!claims.canonicalUrl) {
        throw new OAuthError("Provider did not return a canonical profile URL", 502);
      }

      const sealed = await sealTokenBundle(tokens, key);
      const subjectHash = await hashProviderSubject(tokens.providerSubject);
      const stamp = now.toISOString();
      const existing = await deps.grants.getForProfileProvider(
        session.profileId,
        input.provider,
      );
      const grant: StoredProviderGrant = {
        id: existing?.id ?? newId("grant"),
        profileId: session.profileId,
        socialConnectionId: existing?.socialConnectionId ?? null,
        provider: input.provider,
        providerSubjectHash: subjectHash,
        grant: sealed,
        grantedScopes: tokens.grantedScopes,
        status: "active",
        expiresAt: tokens.expiresAt ?? null,
        nextRefreshAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
        refreshBackoffSeconds: 3600,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
        revokedAt: null,
      };
      await deps.grants.upsert(grant);

      const baseConnection: SocialConnection =
        input.existingConnection ??
        ({
          id: newId("soc"),
          profileId: session.profileId,
          provider: input.provider,
          canonicalUrl: claims.canonicalUrl,
          consecutiveDefinitiveFailures: 0,
          createdAt: stamp,
          updatedAt: stamp,
          status: "unknown",
        } satisfies SocialConnection);

      const connection = applyProviderClaimsToConnection(
        {
          ...baseConnection,
          providerSubjectHash: subjectHash,
        },
        claims,
        now,
      );

      const publicGrant = toPublicGrant(grant);
      const payload = {
        grant: publicGrant,
        connection,
        claimsOmitted: claims.omittedFields,
        returnTo: session.returnTo.startsWith("/") ? session.returnTo : "/",
      };
      assertNoSecretsInPublicPayload(payload);
      return payload;
    },

    async refresh(input) {
      const now = input.now ?? new Date();
      const stored = await deps.grants.getActive(input.profileId, input.provider);
      if (!stored) throw new OAuthError("No active provider grant", 404);
      const adapter = adapterFor(input.provider);

      try {
        const tokens = await openTokenBundle(stored.grant, key);
        const claims = await adapter.refreshPublicClaims(tokens);
        const stamp = now.toISOString();
        const updatedGrant: StoredProviderGrant = {
          ...stored,
          updatedAt: stamp,
          nextRefreshAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
          refreshBackoffSeconds: 3600,
          status: "active",
        };
        await deps.grants.upsert(updatedGrant);
        const connection = applyProviderClaimsToConnection(input.connection, claims, now);
        const payload = {
          grant: toPublicGrant(updatedGrant),
          connection,
          claimsOmitted: claims.omittedFields,
        };
        assertNoSecretsInPublicPayload(payload);
        return payload;
      } catch (error) {
        const backoff = nextRefreshBackoffSeconds(stored.refreshBackoffSeconds);
        await deps.grants.upsert({
          ...stored,
          refreshBackoffSeconds: backoff,
          nextRefreshAt: new Date(now.getTime() + backoff * 1000).toISOString(),
          updatedAt: now.toISOString(),
        });
        throw error;
      }
    },

    async disconnect(input) {
      const now = input.now ?? new Date();
      const stored = await deps.grants.getActive(input.profileId, input.provider);
      if (stored) {
        const adapter = adapterFor(input.provider);
        try {
          const tokens = await openTokenBundle(stored.grant, key);
          await adapter.revoke(tokens);
        } catch {
          // Still mark local grant revoked so UI/API stop advertising provider status.
        }
        const revoked: StoredProviderGrant = {
          ...stored,
          status: "revoked",
          revokedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          nextRefreshAt: null,
          grant: { kid: "v1", iv: "", ciphertext: "" },
        };
        await deps.grants.upsert(revoked);
        const connection: SocialConnection = {
          ...input.connection,
          status:
            input.connection.status === "oauth_verified"
              ? "live"
              : input.connection.status,
          verifiedAt: undefined,
          scopesJson: undefined,
          accountCreatedAtSource:
            input.connection.accountCreatedAtSource === "provider"
              ? "self_reported"
              : input.connection.accountCreatedAtSource,
          connectionCountSource:
            input.connection.connectionCountSource === "provider"
              ? "self_reported"
              : input.connection.connectionCountSource,
          updatedAt: now.toISOString(),
        };
        return { grant: toPublicGrant(revoked), connection };
      }

      return {
        grant: null,
        connection: {
          ...input.connection,
          status:
            input.connection.status === "oauth_verified"
              ? "live"
              : input.connection.status,
          updatedAt: now.toISOString(),
        },
      };
    },

    async listPublicGrants(profileId) {
      const rows = await deps.grants.listForProfile(profileId);
      return rows.map(toPublicGrant);
    },
  };
}

export function randomEncryptionKeyHex(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
