import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  oauthSessions,
  profiles,
  providerGrants,
  socialConnections,
} from "../../../db/schema";
import type { SocialConnection, SocialProvider } from "../types.ts";
import { facebookAdapterFromEnv } from "./adapters/facebook.ts";
import { createMockSocialAdapter } from "./adapters/mock.ts";
import {
  createOAuthService,
  type OAuthService,
  type OAuthSessionStore,
  type ProviderGrantStore,
} from "./service.ts";
import type { OAuthSession, SocialIdentityAdapter, StoredProviderGrant } from "./types.ts";
import { OAuthError } from "./types.ts";

function parseScopes(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function rowToGrant(row: typeof providerGrants.$inferSelect): StoredProviderGrant {
  return {
    id: row.id,
    profileId: row.profileId,
    socialConnectionId: row.socialConnectionId,
    provider: row.provider as SocialProvider,
    providerSubjectHash: row.providerSubjectHash,
    grant: {
      kid: row.grantKid,
      iv: row.grantIv,
      ciphertext: row.grantCiphertext,
    },
    grantedScopes: parseScopes(row.grantedScopesJson),
    status: row.status as StoredProviderGrant["status"],
    expiresAt: row.expiresAt,
    nextRefreshAt: row.nextRefreshAt,
    refreshBackoffSeconds: row.refreshBackoffSeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt,
  };
}

export async function createD1OAuthSessionStore(): Promise<OAuthSessionStore> {
  return {
    async put(session: OAuthSession) {
      const db = await getDb();
      await db
        .insert(oauthSessions)
        .values({
          state: session.state,
          profileId: session.profileId,
          provider: session.provider,
          codeVerifier: session.codeVerifier,
          redirectUri: session.redirectUri,
          returnTo: session.returnTo,
          nonce: session.nonce,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })
        .onConflictDoUpdate({
          target: oauthSessions.state,
          set: {
            profileId: session.profileId,
            provider: session.provider,
            codeVerifier: session.codeVerifier,
            redirectUri: session.redirectUri,
            returnTo: session.returnTo,
            nonce: session.nonce,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
          },
        });
    },
    async take(state: string) {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(oauthSessions)
        .where(eq(oauthSessions.state, state))
        .limit(1);
      if (!row) return null;
      await db.delete(oauthSessions).where(eq(oauthSessions.state, state));
      return {
        state: row.state,
        profileId: row.profileId,
        provider: row.provider as SocialProvider,
        codeVerifier: row.codeVerifier,
        redirectUri: row.redirectUri,
        returnTo: row.returnTo,
        nonce: row.nonce,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      };
    },
  };
}

export async function createD1ProviderGrantStore(): Promise<ProviderGrantStore> {
  return {
    async upsert(grant) {
      const db = await getDb();
      await db
        .insert(providerGrants)
        .values({
          id: grant.id,
          profileId: grant.profileId,
          socialConnectionId: grant.socialConnectionId,
          provider: grant.provider,
          providerSubjectHash: grant.providerSubjectHash,
          grantKid: grant.grant.kid,
          grantIv: grant.grant.iv,
          grantCiphertext: grant.grant.ciphertext,
          grantedScopesJson: JSON.stringify(grant.grantedScopes),
          status: grant.status,
          expiresAt: grant.expiresAt,
          nextRefreshAt: grant.nextRefreshAt,
          refreshBackoffSeconds: grant.refreshBackoffSeconds,
          createdAt: grant.createdAt,
          updatedAt: grant.updatedAt,
          revokedAt: grant.revokedAt,
        })
        .onConflictDoUpdate({
          target: [providerGrants.profileId, providerGrants.provider],
          set: {
            id: grant.id,
            socialConnectionId: grant.socialConnectionId,
            providerSubjectHash: grant.providerSubjectHash,
            grantKid: grant.grant.kid,
            grantIv: grant.grant.iv,
            grantCiphertext: grant.grant.ciphertext,
            grantedScopesJson: JSON.stringify(grant.grantedScopes),
            status: grant.status,
            expiresAt: grant.expiresAt,
            nextRefreshAt: grant.nextRefreshAt,
            refreshBackoffSeconds: grant.refreshBackoffSeconds,
            updatedAt: grant.updatedAt,
            revokedAt: grant.revokedAt,
          },
        });
    },
    async getById(id) {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(providerGrants)
        .where(eq(providerGrants.id, id))
        .limit(1);
      return row ? rowToGrant(row) : null;
    },
    async listForProfile(profileId) {
      const db = await getDb();
      const rows = await db
        .select()
        .from(providerGrants)
        .where(eq(providerGrants.profileId, profileId));
      return rows.map(rowToGrant);
    },
    async getForProfileProvider(profileId, provider) {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(providerGrants)
        .where(
          and(eq(providerGrants.profileId, profileId), eq(providerGrants.provider, provider)),
        )
        .limit(1);
      return row ? rowToGrant(row) : null;
    },
    async getActive(profileId, provider) {
      const row = await this.getForProfileProvider(profileId, provider);
      return row?.status === "active" ? row : null;
    },
  };
}

function adaptersFromEnv(): Partial<Record<SocialProvider, SocialIdentityAdapter>> {
  const adapters: Partial<Record<SocialProvider, SocialIdentityAdapter>> = {};
  const facebook = facebookAdapterFromEnv({
    FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
    FACEBOOK_GRAPH_VERSION: process.env.FACEBOOK_GRAPH_VERSION,
  });
  if (facebook) {
    adapters.facebook = facebook;
  } else if (process.env.ALLOW_MOCK_OAUTH === "1") {
    adapters.facebook = createMockSocialAdapter({
      supplyAccountCreatedAt: true,
      supplyConnectionCount: false,
    });
  }
  return adapters;
}

export async function buildRuntimeOAuthService(): Promise<{
  service: OAuthService;
  ensureProfile: (profileId: string) => Promise<void>;
  upsertConnection: (connection: SocialConnection) => Promise<void>;
  loadConnection: (
    profileId: string,
    provider: SocialProvider,
  ) => Promise<SocialConnection | null>;
  /** Keep profiles.social_accounts_json aligned with oauth_verified connections. */
  syncProfileSocialAccounts: (profileId: string) => Promise<void>;
}> {
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new OAuthError("OAUTH_TOKEN_ENCRYPTION_KEY is not configured", 503);
  }

  const adapters = adaptersFromEnv();
  if (!Object.keys(adapters).length) {
    throw new OAuthError(
      "No OAuth providers configured. Set FACEBOOK_APP_ID/SECRET or ALLOW_MOCK_OAUTH=1.",
      503,
    );
  }

  const sessions = await createD1OAuthSessionStore();
  const grants = await createD1ProviderGrantStore();
  const service = createOAuthService({ adapters, sessions, grants, encryptionKey });

  return {
    service,
    async ensureProfile(profileId) {
      const db = await getDb();
      const updatedAt = new Date().toISOString();
      await db
        .insert(profiles)
        .values({
          id: profileId,
          displayName: `Seller ${profileId.slice(0, 8)}`,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { updatedAt },
        });
    },
    async upsertConnection(connection) {
      const db = await getDb();
      await db
        .insert(socialConnections)
        .values({
          id: connection.id,
          profileId: connection.profileId,
          provider: connection.provider,
          providerSubjectHash: connection.providerSubjectHash,
          canonicalUrl: connection.canonicalUrl,
          handle: connection.handle,
          status: connection.status,
          accountCreatedAt: connection.accountCreatedAt,
          accountCreatedAtSource: connection.accountCreatedAtSource,
          connectionCount: connection.connectionCount,
          connectionLabel: connection.connectionLabel,
          connectionCountSource: connection.connectionCountSource,
          verifiedAt: connection.verifiedAt,
          lastCheckedAt: connection.lastCheckedAt,
          lastSuccessfulRefreshAt: connection.lastSuccessfulRefreshAt,
          consecutiveDefinitiveFailures: connection.consecutiveDefinitiveFailures,
          nextCheckAt: connection.nextCheckAt,
          scopesJson: connection.scopesJson,
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
        })
        .onConflictDoUpdate({
          target: socialConnections.id,
          set: {
            providerSubjectHash: connection.providerSubjectHash,
            canonicalUrl: connection.canonicalUrl,
            handle: connection.handle,
            status: connection.status,
            accountCreatedAt: connection.accountCreatedAt,
            accountCreatedAtSource: connection.accountCreatedAtSource,
            connectionCount: connection.connectionCount,
            connectionLabel: connection.connectionLabel,
            connectionCountSource: connection.connectionCountSource,
            verifiedAt: connection.verifiedAt,
            lastCheckedAt: connection.lastCheckedAt,
            lastSuccessfulRefreshAt: connection.lastSuccessfulRefreshAt,
            consecutiveDefinitiveFailures: connection.consecutiveDefinitiveFailures,
            nextCheckAt: connection.nextCheckAt,
            scopesJson: connection.scopesJson,
            updatedAt: connection.updatedAt,
          },
        });
    },
    async loadConnection(profileId, provider) {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(socialConnections)
        .where(
          and(
            eq(socialConnections.profileId, profileId),
            eq(socialConnections.provider, provider),
          ),
        )
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        profileId: row.profileId,
        provider: row.provider as SocialProvider,
        providerSubjectHash: row.providerSubjectHash ?? undefined,
        canonicalUrl: row.canonicalUrl,
        handle: row.handle ?? undefined,
        status: row.status as SocialConnection["status"],
        accountCreatedAt: row.accountCreatedAt ?? undefined,
        accountCreatedAtSource: row.accountCreatedAtSource as
          | SocialConnection["accountCreatedAtSource"]
          | undefined,
        connectionCount: row.connectionCount ?? undefined,
        connectionLabel: row.connectionLabel as SocialConnection["connectionLabel"] | undefined,
        connectionCountSource: row.connectionCountSource as
          | SocialConnection["connectionCountSource"]
          | undefined,
        verifiedAt: row.verifiedAt ?? undefined,
        lastCheckedAt: row.lastCheckedAt ?? undefined,
        lastSuccessfulRefreshAt: row.lastSuccessfulRefreshAt ?? undefined,
        consecutiveDefinitiveFailures: row.consecutiveDefinitiveFailures,
        nextCheckAt: row.nextCheckAt ?? undefined,
        scopesJson: row.scopesJson ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
    async syncProfileSocialAccounts(profileId) {
      const db = await getDb();
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);
      let accounts: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(profile?.socialAccountsJson || "[]") as unknown;
        accounts = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      } catch {
        accounts = [];
      }

      const connections = await db
        .select()
        .from(socialConnections)
        .where(eq(socialConnections.profileId, profileId));

      for (const connection of connections) {
        const idx = accounts.findIndex((a) => a.provider === connection.provider);
        const next = {
          provider: connection.provider,
          url: connection.canonicalUrl,
          handle: connection.handle ?? undefined,
          metricsSource:
            connection.status === "oauth_verified" ? "oauth" : "self-reported",
          health:
            connection.status === "dead" || connection.status === "invalid"
              ? connection.status
              : connection.status === "oauth_verified" || connection.status === "live"
                ? "active"
                : "unknown",
          accountCreatedAt: connection.accountCreatedAt ?? undefined,
          connectionCount: connection.connectionCount ?? undefined,
          connectionLabel: connection.connectionLabel ?? undefined,
          lastCheckedAt:
            connection.lastSuccessfulRefreshAt ??
            connection.verifiedAt ??
            connection.lastCheckedAt ??
            undefined,
        };
        if (idx >= 0) accounts[idx] = { ...accounts[idx], ...next };
        else accounts.push(next);
      }

      const updatedAt = new Date().toISOString();
      await db
        .update(profiles)
        .set({ socialAccountsJson: JSON.stringify(accounts), updatedAt })
        .where(eq(profiles.id, profileId));
    },
  };
}

export function isSupportedOAuthProvider(value: string): value is SocialProvider {
  return value === "facebook";
}
