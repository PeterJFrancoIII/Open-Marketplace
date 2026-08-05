import type {
  SocialConnectionStatus,
  TransactionStatus,
  ReviewVisibility,
} from "./types.ts";

export class InvalidTrustTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTrustTransitionError";
  }
}

const TRANSACTION_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  proposed: ["accepted", "canceled"],
  accepted: ["fulfilled", "canceled", "disputed"],
  fulfilled: ["completed", "disputed", "canceled"],
  disputed: ["completed", "canceled"],
  completed: ["review_window"],
  review_window: [],
  canceled: [],
};

/** Link-health lifecycle from SOCIAL_TRUST_FRAMEWORK §7. */
export function nextLinkHealth(
  current: SocialConnectionStatus,
  signal:
    | "allowlisted_success"
    | "temporary_failure"
    | "definitive_failure"
    | "definitive_failure_confirmed"
    | "invalid"
    | "user_fixed"
    | "user_removed"
    | "grace_notice",
  consecutiveDefinitiveFailures = 0,
): { status: SocialConnectionStatus; consecutiveDefinitiveFailures: number } {
  if (signal === "invalid") {
    return { status: "invalid", consecutiveDefinitiveFailures };
  }
  if (signal === "user_removed") {
    return { status: "invalid", consecutiveDefinitiveFailures: 0 };
  }
  if (signal === "user_fixed") {
    return { status: "live", consecutiveDefinitiveFailures: 0 };
  }
  if (signal === "allowlisted_success") {
    return { status: "live", consecutiveDefinitiveFailures: 0 };
  }
  if (signal === "temporary_failure") {
    // unknown must not punish; stay/enter unknown from live or unknown
    if (current === "dead" || current === "action_required" || current === "invalid") {
      return { status: current, consecutiveDefinitiveFailures };
    }
    return { status: "unknown", consecutiveDefinitiveFailures };
  }
  if (signal === "definitive_failure") {
    const next = consecutiveDefinitiveFailures + 1;
    if (next >= 2 || current === "dead") {
      return { status: "dead", consecutiveDefinitiveFailures: next };
    }
    return { status: current === "live" ? "unknown" : current, consecutiveDefinitiveFailures: next };
  }
  if (signal === "definitive_failure_confirmed") {
    return { status: "dead", consecutiveDefinitiveFailures: Math.max(2, consecutiveDefinitiveFailures + 1) };
  }
  if (signal === "grace_notice") {
    if (current === "dead" || current === "invalid") {
      return { status: "action_required", consecutiveDefinitiveFailures };
    }
    return { status: current, consecutiveDefinitiveFailures };
  }
  return { status: current, consecutiveDefinitiveFailures };
}

export function assertTransactionTransition(
  from: TransactionStatus,
  to: TransactionStatus,
): void {
  const allowed = TRANSACTION_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTrustTransitionError(
      `Invalid transaction transition ${from} → ${to}`,
    );
  }
}

export function canAcceptReview(input: {
  transactionStatus: TransactionStatus;
  buyerId: string;
  sellerId: string;
  reviewerId: string;
  subjectId: string;
  role: "buyer_reviews_seller" | "seller_reviews_buyer";
  existingReview: boolean;
}): void {
  if (input.buyerId === input.sellerId) {
    throw new InvalidTrustTransitionError("Buyer and seller must differ");
  }
  if (
    input.transactionStatus !== "completed" &&
    input.transactionStatus !== "review_window"
  ) {
    throw new InvalidTrustTransitionError(
      "Reviews require a completed (or review-window) transaction",
    );
  }
  if (input.existingReview) {
    throw new InvalidTrustTransitionError("Duplicate review for role/transaction");
  }
  if (input.role === "buyer_reviews_seller") {
    if (input.reviewerId !== input.buyerId || input.subjectId !== input.sellerId) {
      throw new InvalidTrustTransitionError("Buyer must review seller only");
    }
  } else if (
    input.reviewerId !== input.sellerId ||
    input.subjectId !== input.buyerId
  ) {
    throw new InvalidTrustTransitionError("Seller must review buyer only");
  }
}

export function canEditReview(visibility: ReviewVisibility): void {
  if (visibility !== "sealed") {
    throw new InvalidTrustTransitionError("Only sealed reviews may be edited");
  }
}

export const REVIEW_WINDOW_DAYS = 14;

export function reviewRevealAt(
  completedAt: Date,
  bothSubmitted: boolean,
  now = new Date(),
): Date | null {
  if (bothSubmitted) return now;
  const deadline = new Date(completedAt);
  deadline.setUTCDate(deadline.getUTCDate() + REVIEW_WINDOW_DAYS);
  if (now >= deadline) return deadline;
  return null;
}
