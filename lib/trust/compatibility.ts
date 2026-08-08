import type { SocialProof } from "../types.ts";
import type {
  ProfileStanding,
  SocialConnection,
  TrustCardModel,
  TrustFacetProjection,
} from "./types.ts";
import { experienceLabel, PROJECTION_VERSION } from "./projections.ts";

/** Map legacy listing SocialProof JSON into normalized SocialConnection rows. */
export function socialProofsToConnections(
  profileId: string,
  proofs: SocialProof[],
  now = new Date().toISOString(),
): SocialConnection[] {
  return proofs.map((proof, index) => {
    const health = proof.health ?? "unknown";
    const status =
      health === "active"
        ? proof.metricsSource === "oauth"
          ? "oauth_verified"
          : "live"
        : health === "dead"
          ? "dead"
          : health === "invalid"
            ? "invalid"
            : "unknown";

    return {
      id: `${profileId}-social-${index}`,
      profileId,
      provider: proof.provider,
      canonicalUrl: proof.url,
      handle: proof.handle,
      status,
      accountCreatedAt: proof.accountCreatedAt,
      accountCreatedAtSource: proof.accountCreatedAt ? "self_reported" : undefined,
      connectionCount: proof.connectionCount,
      connectionLabel: proof.connectionLabel,
      connectionCountSource: proof.connectionCount != null ? "self_reported" : undefined,
      lastCheckedAt: proof.lastCheckedAt,
      consecutiveDefinitiveFailures: status === "dead" ? 2 : 0,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function standingFromFacts(input: {
  suspended?: boolean;
  socialActionRequired?: boolean;
  completedSales: number;
}): ProfileStanding {
  if (input.suspended) return "suspended";
  if (input.socialActionRequired) return "social_action_required";
  const label = experienceLabel(input.completedSales);
  if (label === "New") return "new";
  if (label === "Active") return "active";
  return "established";
}

/** Compatibility read: build TrustCardModel from current profile+listing fields. */
export function trustCardFromLegacyProfile(input: {
  profileId: string;
  displayName: string;
  memberSince: string;
  itemsSold: number;
  sellerRating?: number | null;
  sellerRatingCount?: number;
  buyerRating?: number | null;
  buyerRatingCount?: number;
  socialProofs: SocialProof[];
  socialActionRequired?: boolean;
  suspended?: boolean;
}): TrustCardModel {
  const calculatedAt = new Date().toISOString();
  const connections = socialProofsToConnections(
    input.profileId,
    input.socialProofs,
    calculatedAt,
  );
  const standing = standingFromFacts({
    suspended: input.suspended,
    socialActionRequired:
      input.socialActionRequired ||
      connections.some((c) => c.status === "action_required" || c.status === "dead"),
    completedSales: input.itemsSold,
  });

  const facets: TrustFacetProjection = {
    profileId: input.profileId,
    projectionVersion: PROJECTION_VERSION,
    calculatedAt,
    standing,
    memberSince: input.memberSince,
    experienceLabel: experienceLabel(input.itemsSold),
    seller: {
      displayMean:
        (input.sellerRatingCount ?? 0) >= 3 ? (input.sellerRating ?? null) : null,
      ratingCount: input.sellerRatingCount ?? 0,
      completedSales: input.itemsSold,
      recent12MonthMean: null,
      recent12MonthCount: 0,
      dimensions: {},
    },
    buyer: {
      displayMean:
        (input.buyerRatingCount ?? 0) >= 3 ? (input.buyerRating ?? null) : null,
      ratingCount: input.buyerRatingCount ?? 0,
      completedPurchases: 0,
      recent12MonthMean: null,
      recent12MonthCount: 0,
      dimensions: {},
    },
    socialConnections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      canonicalUrl: c.canonicalUrl,
      handle: c.handle,
      status: c.status,
      accountCreatedAt: c.accountCreatedAt,
      accountCreatedAtSource: c.accountCreatedAtSource,
      connectionCount: c.connectionCount,
      connectionLabel: c.connectionLabel,
      connectionCountSource: c.connectionCountSource,
      lastCheckedAt: c.lastCheckedAt,
      lastSuccessfulRefreshAt: c.lastSuccessfulRefreshAt,
    })),
    assuranceTier: ["A0"],
  };

  return {
    profileId: input.profileId,
    displayName: input.displayName,
    facets,
    disclosures: [
      "Ratings shown here are provisional until transaction-bound reviews ship.",
      "Social link health proves URL availability, not identity.",
      "Follower and friend counts never affect ranking or access.",
    ],
  };
}
