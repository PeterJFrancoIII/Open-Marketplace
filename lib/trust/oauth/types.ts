import type { SocialProvider } from "../types.ts";

/** Opaque ciphertext envelope — never log or return to the browser. */
export type EncryptedProviderGrant = {
  kid: string;
  ciphertext: string;
  iv: string;
};

export type ProviderTokenBundle = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  providerSubject: string;
  grantedScopes: string[];
};

export type ProviderPublicClaims = {
  providerSubject: string;
  canonicalUrl: string;
  handle?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: "friends" | "followers";
  grantedScopes: string[];
  fetchedAt: string;
  /** Fields the provider did not supply (honest degradation). */
  omittedFields: Array<
    "accountCreatedAt" | "connectionCount" | "handle" | "canonicalUrl"
  >;
};

export type SocialIdentityAdapter = {
  provider: SocialProvider;
  beginAuthorization(input: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
    nonce: string;
  }): Promise<URL>;
  exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ProviderTokenBundle>;
  refreshPublicClaims(tokens: ProviderTokenBundle): Promise<ProviderPublicClaims>;
  revoke(tokens: ProviderTokenBundle): Promise<void>;
};

export type OAuthSession = {
  state: string;
  profileId: string;
  provider: SocialProvider;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
};

export type StoredProviderGrant = {
  id: string;
  profileId: string;
  socialConnectionId: string | null;
  provider: SocialProvider;
  providerSubjectHash: string;
  grant: EncryptedProviderGrant;
  grantedScopes: string[];
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
  nextRefreshAt: string | null;
  refreshBackoffSeconds: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

/** Safe public view — scopes and status only, never tokens. */
export type PublicGrantView = {
  id: string;
  profileId: string;
  provider: SocialProvider;
  status: StoredProviderGrant["status"];
  grantedScopes: string[];
  expiresAt: string | null;
  nextRefreshAt: string | null;
  connectedAt: string;
  revokedAt: string | null;
};

export class OAuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OAuthError";
    this.status = status;
  }
}
