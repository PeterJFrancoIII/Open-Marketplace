/**
 * Social trust domain types — PR 1 foundation.
 * See SOCIAL_TRUST_FRAMEWORK.md. No universal trust score.
 */

export type AssuranceTier = "A0" | "A1" | "A2" | "A3";

export type SocialProvider = "facebook" | "instagram" | "tiktok" | "other";

export type SocialConnectionStatus =
  | "oauth_verified"
  | "live"
  | "unknown"
  | "dead"
  | "invalid"
  | "expired"
  | "action_required";

export type MetricSource = "provider" | "self_reported" | "link_check";

export type ProfileStanding =
  | "new"
  | "active"
  | "established"
  | "suspended"
  | "social_action_required";

export type TransactionStatus =
  | "proposed"
  | "accepted"
  | "fulfilled"
  | "completed"
  | "canceled"
  | "disputed"
  | "review_window";

export type ReviewVisibility = "sealed" | "revealed" | "removed";

export type ReviewRole = "buyer_reviews_seller" | "seller_reviews_buyer";

export type SocialConnection = {
  id: string;
  profileId: string;
  provider: SocialProvider;
  providerSubjectHash?: string;
  canonicalUrl: string;
  handle?: string;
  status: SocialConnectionStatus;
  accountCreatedAt?: string;
  accountCreatedAtSource?: "provider" | "self_reported";
  connectionCount?: number;
  connectionLabel?: "friends" | "followers";
  connectionCountSource?: "provider" | "self_reported";
  verifiedAt?: string;
  lastCheckedAt?: string;
  lastSuccessfulRefreshAt?: string;
  consecutiveDefinitiveFailures: number;
  nextCheckAt?: string;
  scopesJson?: string;
  createdAt: string;
  updatedAt: string;
};

/** v1: priorEventHash = prior payload hash. v2+: priorEventId = prior event id. */
export const TRUST_ENVELOPE_SCHEMA_V1 = 1;
export const TRUST_ENVELOPE_SCHEMA_V2 = 2;
export const TRUST_ENVELOPE_SCHEMA_CURRENT = TRUST_ENVELOPE_SCHEMA_V2;

export type TrustEventEnvelope = {
  eventId: string;
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt: string;
  payloadHash: string;
  /**
   * Legacy v1 signed prior link: prior event payload hash.
   * Omitted/undefined for genesis. Never rewritten by SQL migrations.
   */
  priorEventHash?: string;
  /**
   * v2+ signed prior link: prior event id.
   * Omitted/undefined for genesis (same sentinel the signer uses).
   */
  priorEventId?: string;
  registryId: string;
  schemaVersion: number;
  signature: string;
};

export type TrustFacetProjection = {
  profileId: string;
  projectionVersion: string;
  calculatedAt: string;
  lastEventId?: string;
  standing: ProfileStanding;
  memberSince: string;
  experienceLabel: "New" | "Active" | "Established";
  seller: {
    displayMean: number | null;
    ratingCount: number;
    completedSales: number;
    recent12MonthMean: number | null;
    recent12MonthCount: number;
    dimensions: Record<string, { mean: number | null; count: number }>;
  };
  buyer: {
    displayMean: number | null;
    ratingCount: number;
    completedPurchases: number;
    recent12MonthMean: number | null;
    recent12MonthCount: number;
    dimensions: Record<string, { mean: number | null; count: number }>;
  };
  socialConnections: Array<{
    id: string;
    provider: SocialProvider;
    canonicalUrl: string;
    handle?: string;
    status: SocialConnectionStatus;
    accountCreatedAt?: string;
    accountCreatedAtSource?: MetricSource | "provider" | "self_reported";
    connectionCount?: number;
    connectionLabel?: "friends" | "followers";
    connectionCountSource?: "provider" | "self_reported";
    lastCheckedAt?: string;
    lastSuccessfulRefreshAt?: string;
  }>;
  assuranceTier: AssuranceTier[];
};

/** Public read model — facets and evidence, never one total score. */
export type TrustCardModel = {
  profileId: string;
  displayName: string;
  facets: TrustFacetProjection;
  disclosures: string[];
};
