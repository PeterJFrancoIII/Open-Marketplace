/**
 * Versioned reputation projections — Bayesian mean + Wilson lower bound.
 * SOCIAL_TRUST_FRAMEWORK §10.
 */

export const PROJECTION_VERSION = "trust-agg-v1";
export const BAYESIAN_PRIOR_WEIGHT = 5;

export function bayesianDisplayMean(
  ratings: number[],
  marketplaceMean: number,
  priorWeight = BAYESIAN_PRIOR_WEIGHT,
): { displayMean: number | null; ratingCount: number } {
  const ratingCount = ratings.length;
  if (ratingCount === 0) {
    return { displayMean: null, ratingCount: 0 };
  }
  const sum = ratings.reduce((a, b) => a + b, 0);
  const displayMean =
    (priorWeight * marketplaceMean + sum) / (priorWeight + ratingCount);
  return {
    displayMean: round1(displayMean),
    ratingCount,
  };
}

/** Wilson score lower bound for a binomial reliability rate. */
export function wilsonLowerBound(
  successes: number,
  trials: number,
  z = 1.96,
): number | null {
  if (trials <= 0) return null;
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return round3((centre - margin) / denom);
}

export function experienceLabel(
  completedSales: number,
): "New" | "Active" | "Established" {
  if (completedSales < 3) return "New";
  if (completedSales < 25) return "Active";
  return "Established";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function rebuildSellerProjection(input: {
  profileId: string;
  memberSince: string;
  ratings: number[];
  marketplaceMean: number;
  completedSales: number;
  recent12MonthRatings: number[];
  calculatedAt: string;
  lastEventId?: string;
}) {
  const lifetime = bayesianDisplayMean(input.ratings, input.marketplaceMean);
  const recent = bayesianDisplayMean(
    input.recent12MonthRatings,
    input.marketplaceMean,
  );
  return {
    profileId: input.profileId,
    projectionVersion: PROJECTION_VERSION,
    calculatedAt: input.calculatedAt,
    lastEventId: input.lastEventId,
    seller: {
      displayMean: lifetime.ratingCount >= 3 ? lifetime.displayMean : null,
      ratingCount: lifetime.ratingCount,
      completedSales: input.completedSales,
      recent12MonthMean: recent.ratingCount >= 3 ? recent.displayMean : null,
      recent12MonthCount: recent.ratingCount,
      dimensions: {},
    },
    experienceLabel: experienceLabel(input.completedSales),
    memberSince: input.memberSince,
  };
}
