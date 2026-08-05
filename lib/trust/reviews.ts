import {
  canAcceptReview,
  canEditReview,
  InvalidTrustTransitionError,
  REVIEW_WINDOW_DAYS,
  reviewRevealAt,
} from "./state-machines.ts";
import type { RequestActor } from "./auth.ts";
import { roleOnTransaction } from "./auth.ts";
import type { ReviewRole, ReviewVisibility, TransactionStatus } from "./types.ts";
import {
  bayesianDisplayMean,
  experienceLabel,
  PROJECTION_VERSION,
  rebuildSellerProjection,
} from "./projections.ts";

export type ReviewDimensionInput = {
  dimension: string;
  score?: number | null;
  boolValue?: boolean | null;
  tag?: string | null;
};

export type ReviewRecord = {
  id: string;
  transactionId: string;
  reviewerId: string;
  subjectId: string;
  role: ReviewRole;
  visibility: ReviewVisibility;
  overallScore: number;
  body: string;
  dimensions: ReviewDimensionInput[];
  revealedAt: string | null;
  removedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicReviewView = {
  id: string;
  transactionId: string;
  reviewerId: string;
  subjectId: string;
  role: ReviewRole;
  visibility: ReviewVisibility;
  /** Null while sealed from the counterparty/public perspective. */
  overallScore: number | null;
  body: string | null;
  dimensions: ReviewDimensionInput[] | null;
  revealedAt: string | null;
  removedReason: string | null;
  createdAt: string;
  sealedExists: boolean;
  reviewDeadlineAt: string | null;
};

const SELLER_DIMENSIONS = new Set([
  "item_matched_description",
  "communication",
  "fulfillment",
]);
const BUYER_DIMENSIONS = new Set([
  "communication",
  "payment_pickup",
  "care",
]);

function nowIso(now: Date): string {
  return now.toISOString();
}

function assertScore(score: number): void {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new InvalidTrustTransitionError("Overall score must be an integer 1–5");
  }
}

function validateDimensions(role: ReviewRole, dimensions: ReviewDimensionInput[]): void {
  for (const dim of dimensions) {
    if (dim.dimension === "item_matched_description") {
      if (role !== "buyer_reviews_seller") {
        throw new InvalidTrustTransitionError("Only buyers rate item match");
      }
      continue;
    }
    const allowed = role === "buyer_reviews_seller" ? SELLER_DIMENSIONS : BUYER_DIMENSIONS;
    if (!allowed.has(dim.dimension)) {
      throw new InvalidTrustTransitionError(`Unsupported dimension: ${dim.dimension}`);
    }
    if (dim.score != null && (!Number.isInteger(dim.score) || dim.score < 1 || dim.score > 5)) {
      throw new InvalidTrustTransitionError(`Dimension ${dim.dimension} score must be 1–5`);
    }
  }
}

export function createSealedReview(input: {
  id: string;
  transaction: {
    id: string;
    buyerId: string;
    sellerId: string;
    status: TransactionStatus;
    completedAt: string | null;
    reviewDeadlineAt: string | null;
  };
  actor: RequestActor;
  overallScore: number;
  body?: string;
  dimensions?: ReviewDimensionInput[];
  existingRoles: ReviewRole[];
  now?: Date;
}): ReviewRecord {
  const roleOnTx = roleOnTransaction(input.actor, input.transaction);
  if (roleOnTx !== "buyer" && roleOnTx !== "seller") {
    throw new InvalidTrustTransitionError("Only transaction parties may review");
  }
  const role: ReviewRole =
    roleOnTx === "buyer" ? "buyer_reviews_seller" : "seller_reviews_buyer";
  const subjectId =
    roleOnTx === "buyer" ? input.transaction.sellerId : input.transaction.buyerId;

  canAcceptReview({
    transactionStatus: input.transaction.status,
    buyerId: input.transaction.buyerId,
    sellerId: input.transaction.sellerId,
    reviewerId: input.actor.profileId,
    subjectId,
    role,
    existingReview: input.existingRoles.includes(role),
  });

  if (input.actor.profileId === subjectId) {
    throw new InvalidTrustTransitionError("Self-reviews are not allowed");
  }

  const now = input.now ?? new Date();
  if (input.transaction.reviewDeadlineAt) {
    if (now.getTime() > new Date(input.transaction.reviewDeadlineAt).getTime()) {
      throw new InvalidTrustTransitionError("Review window has closed");
    }
  } else if (input.transaction.completedAt) {
    const deadline = reviewRevealAt(new Date(input.transaction.completedAt), false, now);
    // reviewRevealAt returns deadline date when window ended; null if still open
    if (deadline && now >= deadline) {
      throw new InvalidTrustTransitionError("Review window has closed");
    }
  }

  assertScore(input.overallScore);
  const dimensions = input.dimensions ?? [];
  validateDimensions(role, dimensions);

  const createdAt = nowIso(now);
  return {
    id: input.id,
    transactionId: input.transaction.id,
    reviewerId: input.actor.profileId,
    subjectId,
    role,
    visibility: "sealed",
    overallScore: input.overallScore,
    body: (input.body ?? "").slice(0, 2000),
    dimensions,
    revealedAt: null,
    removedReason: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function editSealedReview(input: {
  review: ReviewRecord;
  actor: RequestActor;
  overallScore?: number;
  body?: string;
  dimensions?: ReviewDimensionInput[];
  now?: Date;
}): ReviewRecord {
  if (input.actor.profileId !== input.review.reviewerId) {
    throw new InvalidTrustTransitionError("Only the author may edit a sealed review");
  }
  canEditReview(input.review.visibility);
  if (input.overallScore != null) assertScore(input.overallScore);
  const dimensions = input.dimensions ?? input.review.dimensions;
  validateDimensions(input.review.role, dimensions);
  return {
    ...input.review,
    overallScore: input.overallScore ?? input.review.overallScore,
    body: input.body !== undefined ? input.body.slice(0, 2000) : input.review.body,
    dimensions,
    updatedAt: nowIso(input.now ?? new Date()),
  };
}

/**
 * Reveal when both sealed reviews exist OR the 14-day deadline has passed.
 * Returns which reviews should flip to revealed.
 */
export function resolveReveal(input: {
  reviews: ReviewRecord[];
  completedAt: string | null;
  reviewDeadlineAt: string | null;
  now?: Date;
}): { revealIds: string[]; reason: "both_submitted" | "deadline" | null } {
  const now = input.now ?? new Date();
  const active = input.reviews.filter((r) => r.visibility !== "removed");
  const sealedOrRevealed = active.filter(
    (r) => r.visibility === "sealed" || r.visibility === "revealed",
  );
  const sealed = active.filter((r) => r.visibility === "sealed");
  if (sealed.length === 0) {
    return { revealIds: [], reason: null };
  }

  const roles = new Set(sealedOrRevealed.map((r) => r.role));
  const bothSubmitted =
    roles.has("buyer_reviews_seller") && roles.has("seller_reviews_buyer");

  let deadlinePassed = false;
  if (input.reviewDeadlineAt) {
    deadlinePassed = now.getTime() >= new Date(input.reviewDeadlineAt).getTime();
  } else if (input.completedAt) {
    const revealAt = reviewRevealAt(new Date(input.completedAt), false, now);
    deadlinePassed = Boolean(revealAt && now >= revealAt);
  }

  if (bothSubmitted || deadlinePassed) {
    return {
      revealIds: sealed.map((r) => r.id),
      reason: bothSubmitted ? "both_submitted" : "deadline",
    };
  }
  return { revealIds: [], reason: null };
}

export function applyReveal(
  reviews: ReviewRecord[],
  revealIds: string[],
  now = new Date(),
): ReviewRecord[] {
  const stamp = nowIso(now);
  return reviews.map((r) =>
    revealIds.includes(r.id) && r.visibility === "sealed"
      ? { ...r, visibility: "revealed" as const, revealedAt: stamp, updatedAt: stamp }
      : r,
  );
}

/**
 * Double-blind public view: counterparty never sees score/body while sealed.
 * They may learn that a sealed review exists and the shared deadline only.
 */
export function toPublicReviewView(input: {
  review: ReviewRecord;
  viewer: RequestActor;
  reviewDeadlineAt: string | null;
}): PublicReviewView {
  const { review, viewer } = input;
  const isAuthor = viewer.profileId === review.reviewerId;
  const isModerator = viewer.isModerator;
  const revealed = review.visibility === "revealed";
  const removed = review.visibility === "removed";

  if (removed) {
    return {
      id: review.id,
      transactionId: review.transactionId,
      reviewerId: review.reviewerId,
      subjectId: review.subjectId,
      role: review.role,
      visibility: "removed",
      overallScore: null,
      body: null,
      dimensions: null,
      revealedAt: review.revealedAt,
      removedReason: review.removedReason ?? "Review removed",
      createdAt: review.createdAt,
      sealedExists: false,
      reviewDeadlineAt: input.reviewDeadlineAt,
    };
  }

  const canSeeContent = revealed || isAuthor || isModerator;
  return {
    id: review.id,
    transactionId: review.transactionId,
    reviewerId: canSeeContent || isAuthor ? review.reviewerId : "sealed",
    subjectId: review.subjectId,
    role: review.role,
    visibility: review.visibility,
    overallScore: canSeeContent ? review.overallScore : null,
    body: canSeeContent ? review.body : null,
    dimensions: canSeeContent ? review.dimensions : null,
    revealedAt: review.revealedAt,
    removedReason: null,
    createdAt: review.createdAt,
    sealedExists: review.visibility === "sealed",
    reviewDeadlineAt: input.reviewDeadlineAt,
  };
}

export function addPublicResponse(input: {
  review: ReviewRecord;
  actor: RequestActor;
  body: string;
  existingResponse: boolean;
}): { reviewId: string; authorId: string; body: string; kind: "public_response" } {
  if (input.review.visibility !== "revealed") {
    throw new InvalidTrustTransitionError("Responses require a revealed review");
  }
  if (input.actor.profileId !== input.review.subjectId) {
    throw new InvalidTrustTransitionError("Only the review subject may respond");
  }
  if (input.existingResponse) {
    throw new InvalidTrustTransitionError("Only one public response is allowed");
  }
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new InvalidTrustTransitionError("Response body required");
  return {
    reviewId: input.review.id,
    authorId: input.actor.profileId,
    body,
    kind: "public_response",
  };
}

export function tombstoneReview(input: {
  review: ReviewRecord;
  actor: RequestActor;
  reasonCode: string;
  now?: Date;
}): ReviewRecord {
  if (!input.actor.isModerator && input.actor.profileId !== input.review.reviewerId) {
    // Authors may request removal via report; only moderator applies tombstone in PR 3
    // except we allow moderator-only removal to preserve audit.
  }
  if (!input.actor.isModerator) {
    throw new InvalidTrustTransitionError("Only moderators may tombstone a review");
  }
  const allowed = new Set([
    "prohibited_personal_information",
    "policy_violation",
    "extortion",
    "incentivized",
    "other_policy",
  ]);
  if (!allowed.has(input.reasonCode)) {
    throw new InvalidTrustTransitionError("Unknown removal reason");
  }
  const labels: Record<string, string> = {
    prohibited_personal_information: "Review removed: prohibited personal information",
    policy_violation: "Review removed: policy violation",
    extortion: "Review removed: extortion",
    incentivized: "Review removed: incentivized feedback",
    other_policy: "Review removed: policy",
  };
  const stamp = nowIso(input.now ?? new Date());
  return {
    ...input.review,
    visibility: "removed",
    body: "",
    overallScore: input.review.overallScore,
    removedReason: labels[input.reasonCode],
    updatedAt: stamp,
  };
}

/** Eligible revealed reviews for public aggregates (excludes sealed/removed). */
export function eligibleScoresForProjection(reviews: ReviewRecord[]): number[] {
  return reviews
    .filter((r) => r.visibility === "revealed")
    .map((r) => r.overallScore);
}

/**
 * Repeat-counterparty resistance: at most one contribution per pair / 30 days
 * toward public aggregates. Keeps the chronologically first revealed review.
 */
export function filterRepeatCounterparties(
  reviews: ReviewRecord[],
  windowDays = 30,
): ReviewRecord[] {
  const revealed = reviews
    .filter((r) => r.visibility === "revealed" && r.revealedAt)
    .sort((a, b) => (a.revealedAt ?? "").localeCompare(b.revealedAt ?? ""));
  const kept: ReviewRecord[] = [];
  const lastByPair = new Map<string, number>();
  for (const review of revealed) {
    const pair = [review.reviewerId, review.subjectId].sort().join(":");
    const t = new Date(review.revealedAt!).getTime();
    const prev = lastByPair.get(pair);
    if (prev != null && t - prev < windowDays * 86_400_000) {
      continue;
    }
    lastByPair.set(pair, t);
    kept.push(review);
  }
  return kept;
}

export function projectRoleReputation(input: {
  profileId: string;
  memberSince: string;
  role: "seller" | "buyer";
  reviews: ReviewRecord[];
  marketplaceMean?: number;
  completedCount: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const filtered = filterRepeatCounterparties(input.reviews);
  const scores = eligibleScoresForProjection(filtered);
  const yearAgo = new Date(now);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const recent = filtered.filter(
    (r) => r.revealedAt && new Date(r.revealedAt) >= yearAgo,
  );
  const recentScores = eligibleScoresForProjection(recent);
  const mean = input.marketplaceMean ?? 4.5;

  if (input.role === "seller") {
    return rebuildSellerProjection({
      profileId: input.profileId,
      memberSince: input.memberSince,
      ratings: scores,
      marketplaceMean: mean,
      completedSales: input.completedCount,
      recent12MonthRatings: recentScores,
      calculatedAt: nowIso(now),
    });
  }

  const lifetime = bayesianDisplayMean(scores, mean);
  const recentAgg = bayesianDisplayMean(recentScores, mean);
  return {
    profileId: input.profileId,
    projectionVersion: PROJECTION_VERSION,
    calculatedAt: nowIso(now),
    experienceLabel: experienceLabel(input.completedCount),
    memberSince: input.memberSince,
    buyer: {
      displayMean: lifetime.ratingCount >= 3 ? lifetime.displayMean : null,
      ratingCount: lifetime.ratingCount,
      completedPurchases: input.completedCount,
      recent12MonthMean: recentAgg.ratingCount >= 3 ? recentAgg.displayMean : null,
      recent12MonthCount: recentAgg.ratingCount,
      dimensions: {},
    },
  };
}

export { REVIEW_WINDOW_DAYS };
