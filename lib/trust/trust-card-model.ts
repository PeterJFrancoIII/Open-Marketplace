import type { SocialProof } from "../types.ts";
import type {
  AssuranceTier,
  ProfileStanding,
  SocialConnectionStatus,
} from "./types.ts";

export type TrustCardVariant = "compact" | "full" | "moderator";

export type TrustCardSocialChip = {
  id: string;
  provider: string;
  url: string;
  handle?: string;
  status: SocialConnectionStatus | "checking";
  statusLabel: string;
  sourceLabel: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: string;
  lastCheckedAt?: string;
  healthMessage?: string;
};

export type TrustCardViewModel = {
  profileId: string;
  displayName: string;
  memberSince: string;
  memberSinceLabel: string;
  experienceLabel: "New" | "Active" | "Established";
  standing: ProfileStanding;
  seller: {
    displayMean: number | null;
    ratingCount: number;
    completedSales: number;
    recent12MonthMean?: number | null;
    recent12MonthCount?: number;
    label: string;
  };
  buyer: {
    displayMean: number | null;
    ratingCount: number;
    label: string;
  };
  social: TrustCardSocialChip[];
  assuranceTiers: AssuranceTier[];
  assuranceLabels: string[];
  actionRequired: boolean;
  disclosures: string[];
};

function experienceFromSales(completedSales: number): "New" | "Active" | "Established" {
  if (completedSales < 3) return "New";
  if (completedSales < 25) return "Active";
  return "Established";
}

function standingFrom(input: {
  socialActionRequired?: boolean;
  completedSales: number;
}): ProfileStanding {
  if (input.socialActionRequired) return "social_action_required";
  const label = experienceFromSales(input.completedSales);
  if (label === "New") return "new";
  if (label === "Active") return "active";
  return "established";
}

function mapHealth(
  health?: SocialProof["health"],
  metricsSource?: SocialProof["metricsSource"],
): SocialConnectionStatus | "checking" {
  if (health === "checking") return "checking";
  if (health === "dead") return "dead";
  if (health === "invalid") return "invalid";
  if (health === "unknown") return "unknown";
  if (health === "active") {
    return metricsSource === "oauth" ? "oauth_verified" : "live";
  }
  return "unknown";
}

function statusLabel(status: TrustCardSocialChip["status"]): string {
  switch (status) {
    case "oauth_verified":
      return "provider connected";
    case "live":
      return "link live";
    case "dead":
      return "dead link";
    case "invalid":
      return "invalid link";
    case "action_required":
      return "action required";
    case "checking":
      return "checking";
    case "expired":
      return "expired";
    default:
      return "unknown";
  }
}

function sourceLabel(proof: SocialProof): string {
  if (proof.metricsSource === "oauth") return "provider";
  if (proof.accountCreatedAt || proof.connectionCount != null) return "self-reported";
  return "link check";
}

function formatMean(mean: number | null, count: number): string {
  if (count <= 0) return "No reviews yet";
  if (count < 3 || mean == null) return `New — ${count} review${count === 1 ? "" : "s"}`;
  return `${mean.toFixed(1)} from ${count} review${count === 1 ? "" : "s"}`;
}

function memberSinceLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Member recently";
  return `Member since ${date.toLocaleString(undefined, { month: "short", year: "numeric" })}`;
}

/** Build a TrustCard view model from listing/profile fields (compatibility path). */
export function buildTrustCardFromListing(input: {
  profileId: string;
  displayName: string;
  memberSince?: string;
  itemsSold: number;
  sellerRating?: number | null;
  sellerRatingCount?: number;
  buyerRating?: number | null;
  buyerRatingCount?: number;
  socialProofs: SocialProof[];
  socialActionRequired?: boolean;
}): TrustCardViewModel {
  const sellerCount = input.sellerRatingCount ?? 0;
  const buyerCount = input.buyerRatingCount ?? 0;
  const sellerMean =
    sellerCount >= 3 && input.sellerRating != null ? input.sellerRating : null;
  const buyerMean =
    buyerCount >= 3 && input.buyerRating != null ? input.buyerRating : null;
  const memberSince = input.memberSince ?? new Date().toISOString();
  const experienceLabel = experienceFromSales(input.itemsSold);
  const social = input.socialProofs.slice(0, 3).map((proof, index) => {
    const status = mapHealth(proof.health, proof.metricsSource);
    return {
      id: `${input.profileId}-social-${index}`,
      provider: proof.provider,
      url: proof.url,
      handle: proof.handle,
      status,
      statusLabel: statusLabel(status),
      sourceLabel: sourceLabel(proof),
      accountCreatedAt: proof.accountCreatedAt,
      connectionCount: proof.connectionCount,
      connectionLabel: proof.connectionLabel,
      lastCheckedAt: proof.lastCheckedAt,
      healthMessage: proof.healthMessage,
    };
  });

  const actionRequired =
    Boolean(input.socialActionRequired) ||
    social.some((s) => s.status === "dead" || s.status === "invalid" || s.status === "action_required");

  return {
    profileId: input.profileId,
    displayName: input.displayName,
    memberSince,
    memberSinceLabel: memberSinceLabel(memberSince),
    experienceLabel,
    standing: standingFrom({
      socialActionRequired: actionRequired,
      completedSales: input.itemsSold,
    }),
    seller: {
      displayMean: sellerMean,
      ratingCount: sellerCount,
      completedSales: input.itemsSold,
      label: `${formatMean(sellerMean, sellerCount)} · ${input.itemsSold} completed sale${input.itemsSold === 1 ? "" : "s"}`,
    },
    buyer: {
      displayMean: buyerMean,
      ratingCount: buyerCount,
      label: formatMean(buyerMean, buyerCount),
    },
    social,
    assuranceTiers: ["A0"],
    assuranceLabels: ["Device secured"],
    actionRequired,
    disclosures: [
      "Seller and buyer ratings are separate evidence — not one trust score.",
      "Social link health proves a URL is reachable, not identity or character.",
      "Follower and friend counts never affect search ranking or access.",
      "Only reviews from completed authenticated transactions will replace demo aggregates.",
    ],
  };
}

export function hasProviderConnected(model: TrustCardViewModel): boolean {
  return model.social.some((s) => s.status === "oauth_verified");
}
