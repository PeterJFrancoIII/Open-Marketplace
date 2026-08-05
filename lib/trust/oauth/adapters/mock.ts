import { claimsOmitUnsupported } from "../normalize.ts";
import type {
  ProviderPublicClaims,
  ProviderTokenBundle,
  SocialIdentityAdapter,
} from "../types.ts";
import { OAuthError } from "../types.ts";

/**
 * Deterministic adapter for unit tests and local demos without real credentials.
 * Authorization "codes" are `mock:<subject>` and must match the PKCE verifier prefix.
 */
export function createMockSocialAdapter(options?: {
  supplyAccountCreatedAt?: boolean;
  supplyConnectionCount?: boolean;
}): SocialIdentityAdapter {
  const supplyAccountCreatedAt = options?.supplyAccountCreatedAt ?? true;
  const supplyConnectionCount = options?.supplyConnectionCount ?? false;

  return {
    provider: "facebook",

    async beginAuthorization(input) {
      const url = new URL("https://oauth.mock.open-marketplace.local/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", input.state);
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("nonce", input.nonce);
      url.searchParams.set("scope", "public_profile");
      return url;
    },

    async exchangeAuthorizationCode(input) {
      if (!input.code.startsWith("mock:")) {
        throw new OAuthError("Mock adapter expects code mock:<subject>");
      }
      if (!input.codeVerifier || input.codeVerifier.length < 16) {
        throw new OAuthError("Invalid PKCE verifier");
      }
      const subject = input.code.slice("mock:".length) || "user-1";
      return {
        accessToken: `mock-access-${subject}`,
        refreshToken: `mock-refresh-${subject}`,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        providerSubject: subject,
        grantedScopes: ["public_profile"],
      };
    },

    async refreshPublicClaims(tokens: ProviderTokenBundle): Promise<ProviderPublicClaims> {
      return claimsOmitUnsupported({
        providerSubject: tokens.providerSubject,
        canonicalUrl: `https://facebook.com/${tokens.providerSubject}`,
        handle: tokens.providerSubject,
        accountCreatedAt: supplyAccountCreatedAt ? "2018-04-12" : null,
        connectionCount: supplyConnectionCount ? 42 : null,
        connectionLabel: "friends",
        grantedScopes: tokens.grantedScopes,
        fetchedAt: new Date().toISOString(),
      });
    },

    async revoke() {
      // no-op for mock
    },
  };
}
