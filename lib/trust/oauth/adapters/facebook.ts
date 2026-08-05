import { claimsOmitUnsupported } from "../normalize.ts";
import type {
  ProviderPublicClaims,
  ProviderTokenBundle,
  SocialIdentityAdapter,
} from "../types.ts";
import { OAuthError } from "../types.ts";

export type FacebookAdapterConfig = {
  appId: string;
  appSecret: string;
  /** Graph API version, e.g. v21.0 */
  graphVersion?: string;
  /** Least-privilege default: public_profile only. */
  scopes?: string[];
  fetchImpl?: typeof fetch;
};

/**
 * Official Facebook Login Authorization Code + PKCE adapter.
 * Does not scrape; omits friends count / account age unless Graph returns them.
 */
export function createFacebookAdapter(config: FacebookAdapterConfig): SocialIdentityAdapter {
  const version = config.graphVersion ?? "v21.0";
  const scopes = config.scopes ?? ["public_profile"];
  const fetchImpl = config.fetchImpl ?? fetch;

  if (!config.appId || !config.appSecret) {
    throw new OAuthError("Facebook OAuth app id/secret are required", 503);
  }

  return {
    provider: "facebook",

    async beginAuthorization(input) {
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      url.searchParams.set("client_id", config.appId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("state", input.state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes.join(","));
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      // Facebook treats nonce as optional; keep for CSRF defense-in-depth.
      url.searchParams.set("nonce", input.nonce);
      return url;
    },

    async exchangeAuthorizationCode(input) {
      // POST body keeps client_secret and tokens out of request URLs/logs.
      const tokenUrl = `https://graph.facebook.com/${version}/oauth/access_token`;
      const response = await fetchImpl(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.appId,
          client_secret: config.appSecret,
          redirect_uri: input.redirectUri,
          code: input.code,
          code_verifier: input.codeVerifier,
        }),
      });
      const payload = (await response.json()) as {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
        error?: { message?: string };
      };
      if (!response.ok || !payload.access_token) {
        throw new OAuthError(
          payload.error?.message ?? "Facebook token exchange failed",
          502,
        );
      }

      const meUrl = new URL(`https://graph.facebook.com/${version}/me`);
      meUrl.searchParams.set("fields", "id,name,link");
      const meResponse = await fetchImpl(meUrl.toString(), {
        headers: { authorization: `Bearer ${payload.access_token}` },
      });
      const me = (await meResponse.json()) as {
        id?: string;
        name?: string;
        link?: string;
        error?: { message?: string };
      };
      if (!meResponse.ok || !me.id) {
        throw new OAuthError(me.error?.message ?? "Facebook /me failed", 502);
      }

      const expiresAt =
        typeof payload.expires_in === "number"
          ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
          : undefined;

      return {
        accessToken: payload.access_token,
        tokenType: payload.token_type,
        expiresAt,
        providerSubject: me.id,
        grantedScopes: scopes,
      };
    },

    async refreshPublicClaims(tokens: ProviderTokenBundle): Promise<ProviderPublicClaims> {
      const meUrl = new URL(`https://graph.facebook.com/${version}/me`);
      // Request only fields that may exist; Graph omits unauthorized ones.
      meUrl.searchParams.set("fields", "id,name,link");
      const response = await fetchImpl(meUrl.toString(), {
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      });
      const me = (await response.json()) as {
        id?: string;
        name?: string;
        link?: string;
        error?: { message?: string };
      };
      if (!response.ok || !me.id) {
        throw new OAuthError(me.error?.message ?? "Facebook claims refresh failed", 502);
      }

      // Friend counts require user_friends + app review and often return only
      // app-using friends. Omit rather than invent or scrape.
      return claimsOmitUnsupported({
        providerSubject: me.id,
        canonicalUrl: me.link || `https://www.facebook.com/${me.id}`,
        handle: me.name ?? null,
        accountCreatedAt: null,
        connectionCount: null,
        connectionLabel: "friends",
        grantedScopes: tokens.grantedScopes,
        fetchedAt: new Date().toISOString(),
      });
    },

    async revoke(tokens: ProviderTokenBundle) {
      const url = `https://graph.facebook.com/${version}/me/permissions`;
      await fetchImpl(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => undefined);
    },
  };
}

export function facebookAdapterFromEnv(env: {
  FACEBOOK_APP_ID?: string | null;
  FACEBOOK_APP_SECRET?: string | null;
  FACEBOOK_GRAPH_VERSION?: string | null;
}): SocialIdentityAdapter | null {
  const appId = env.FACEBOOK_APP_ID?.trim();
  const appSecret = env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return createFacebookAdapter({
    appId,
    appSecret,
    graphVersion: env.FACEBOOK_GRAPH_VERSION?.trim() || undefined,
  });
}
