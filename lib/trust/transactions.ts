import {
  assertTransactionTransition,
  canAcceptReview,
  InvalidTrustTransitionError,
  REVIEW_WINDOW_DAYS,
} from "./state-machines.ts";
import type { ActorRole, RequestActor } from "./auth.ts";
import { roleOnTransaction } from "./auth.ts";
import type { TransactionStatus } from "./types.ts";

export const MEETUP_NONCE_TTL_MS = 15 * 60 * 1000;

export type TransactionRecord = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  offerCents: number | null;
  currency: string;
  meetupNonce: string | null;
  meetupNonceExpiresAt: string | null;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  completedAt: string | null;
  reviewDeadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionEventInput = {
  type:
    | "accept"
    | "cancel"
    | "dispute"
    | "issue_meetup_nonce"
    | "confirm_meetup"
    | "mark_fulfilled"
    | "complete";
  meetupNonce?: string;
  reason?: string;
};

export type ApplyResult = {
  transaction: TransactionRecord;
  eventType: string;
  appendedStatus: TransactionStatus;
};

function nowIso(now: Date): string {
  return now.toISOString();
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createProposedTransaction(input: {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  offerCents?: number | null;
  currency?: string;
  now?: Date;
}): TransactionRecord {
  if (input.buyerId === input.sellerId) {
    throw new InvalidTrustTransitionError("Buyer and seller must differ");
  }
  const createdAt = nowIso(input.now ?? new Date());
  return {
    id: input.id,
    listingId: input.listingId,
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    status: "proposed",
    offerCents: input.offerCents ?? null,
    currency: input.currency ?? "USD",
    meetupNonce: null,
    meetupNonceExpiresAt: null,
    buyerConfirmedAt: null,
    sellerConfirmedAt: null,
    completedAt: null,
    reviewDeadlineAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Apply a lifecycle event. Enforces:
 * - strangers cannot mutate
 * - only seller accepts; buyer or seller may cancel; moderator may cancel
 * - meetup confirmations are role-scoped (no party completes both sides)
 * - both confirmations auto-complete into review_window
 */
export function applyTransactionEvent(input: {
  transaction: TransactionRecord;
  actor: RequestActor;
  event: TransactionEventInput;
  now?: Date;
}): ApplyResult {
  const now = input.now ?? new Date();
  const role = roleOnTransaction(input.actor, input.transaction);
  if (role === "stranger") {
    throw new InvalidTrustTransitionError("Stranger cannot mutate transaction");
  }

  let tx = { ...input.transaction };

  switch (input.event.type) {
    case "accept": {
      if (role !== "seller") {
        throw new InvalidTrustTransitionError("Only the seller may accept an offer");
      }
      assertTransactionTransition(tx.status, "accepted");
      tx = { ...tx, status: "accepted", updatedAt: nowIso(now) };
      return { transaction: tx, eventType: "offer.accepted", appendedStatus: "accepted" };
    }
    case "cancel": {
      if (role === "moderator" || role === "buyer" || role === "seller") {
        assertTransactionTransition(tx.status, "canceled");
        tx = {
          ...tx,
          status: "canceled",
          meetupNonce: null,
          meetupNonceExpiresAt: null,
          updatedAt: nowIso(now),
        };
        return { transaction: tx, eventType: "transaction.canceled", appendedStatus: "canceled" };
      }
      throw new InvalidTrustTransitionError("Cannot cancel");
    }
    case "dispute": {
      if (role !== "buyer" && role !== "seller") {
        throw new InvalidTrustTransitionError("Only parties may dispute");
      }
      assertTransactionTransition(tx.status, "disputed");
      tx = { ...tx, status: "disputed", updatedAt: nowIso(now) };
      return { transaction: tx, eventType: "transaction.disputed", appendedStatus: "disputed" };
    }
    case "issue_meetup_nonce": {
      if (role !== "buyer" && role !== "seller") {
        throw new InvalidTrustTransitionError("Only parties may issue meetup nonce");
      }
      if (tx.status !== "accepted" && tx.status !== "fulfilled") {
        throw new InvalidTrustTransitionError("Meetup nonce requires accepted/fulfilled status");
      }
      const expires = new Date(now.getTime() + MEETUP_NONCE_TTL_MS);
      tx = {
        ...tx,
        meetupNonce: randomNonce(),
        meetupNonceExpiresAt: expires.toISOString(),
        // re-issue clears prior one-sided confirms for this meetup attempt
        buyerConfirmedAt: null,
        sellerConfirmedAt: null,
        updatedAt: nowIso(now),
      };
      return { transaction: tx, eventType: "meetup.nonce_issued", appendedStatus: tx.status };
    }
    case "confirm_meetup": {
      if (role !== "buyer" && role !== "seller") {
        throw new InvalidTrustTransitionError("Only parties may confirm meetup");
      }
      if (!tx.meetupNonce || !tx.meetupNonceExpiresAt) {
        throw new InvalidTrustTransitionError("No active meetup nonce");
      }
      if (new Date(tx.meetupNonceExpiresAt).getTime() < now.getTime()) {
        throw new InvalidTrustTransitionError("Meetup nonce expired");
      }
      if (!input.event.meetupNonce || input.event.meetupNonce !== tx.meetupNonce) {
        throw new InvalidTrustTransitionError("Meetup nonce mismatch");
      }

      if (role === "buyer") {
        if (tx.buyerConfirmedAt) {
          throw new InvalidTrustTransitionError("Buyer already confirmed meetup");
        }
        // Explicit: buyer cannot set sellerConfirmedAt
        tx = { ...tx, buyerConfirmedAt: nowIso(now), updatedAt: nowIso(now) };
      } else {
        if (tx.sellerConfirmedAt) {
          throw new InvalidTrustTransitionError("Seller already confirmed meetup");
        }
        // Explicit: seller cannot set buyerConfirmedAt
        tx = { ...tx, sellerConfirmedAt: nowIso(now), updatedAt: nowIso(now) };
      }

      if (tx.buyerConfirmedAt && tx.sellerConfirmedAt) {
        if (tx.status === "accepted") {
          assertTransactionTransition("accepted", "fulfilled");
          tx = { ...tx, status: "fulfilled" };
        }
        if (tx.status === "fulfilled" || tx.status === "disputed") {
          if (tx.status === "fulfilled") {
            assertTransactionTransition("fulfilled", "completed");
          } else {
            assertTransactionTransition("disputed", "completed");
          }
          const completedAt = nowIso(now);
          const deadline = new Date(now);
          deadline.setUTCDate(deadline.getUTCDate() + REVIEW_WINDOW_DAYS);
          tx = {
            ...tx,
            status: "review_window",
            completedAt,
            reviewDeadlineAt: deadline.toISOString(),
            meetupNonce: null,
            meetupNonceExpiresAt: null,
            updatedAt: completedAt,
          };
          // completed → review_window is modeled as arriving in review_window
          // after both-party confirmation (see framework §8).
        }
      }

      return {
        transaction: tx,
        eventType: role === "buyer" ? "meetup.buyer_confirmed" : "meetup.seller_confirmed",
        appendedStatus: tx.status,
      };
    }
    case "mark_fulfilled": {
      // Shipping path — each party may attest fulfillment, but not both sides via one call.
      if (role !== "buyer" && role !== "seller") {
        throw new InvalidTrustTransitionError("Only parties may mark fulfilled");
      }
      assertTransactionTransition(tx.status, "fulfilled");
      tx = { ...tx, status: "fulfilled", updatedAt: nowIso(now) };
      return { transaction: tx, eventType: "transaction.fulfilled", appendedStatus: "fulfilled" };
    }
    case "complete": {
      // Explicit completion still requires prior fulfillment; cannot skip meetup/shipping.
      if (role !== "buyer" && role !== "seller") {
        throw new InvalidTrustTransitionError("Only parties may complete");
      }
      assertTransactionTransition(tx.status, "completed");
      const completedAt = nowIso(now);
      const deadline = new Date(now);
      deadline.setUTCDate(deadline.getUTCDate() + REVIEW_WINDOW_DAYS);
      tx = {
        ...tx,
        status: "review_window",
        completedAt,
        reviewDeadlineAt: deadline.toISOString(),
        updatedAt: completedAt,
      };
      return { transaction: tx, eventType: "transaction.completed", appendedStatus: "review_window" };
    }
    default:
      throw new InvalidTrustTransitionError("Unknown event type");
  }
}

export function reviewEligibility(input: {
  transaction: TransactionRecord;
  actor: RequestActor;
  existingReviewRoles: Array<"buyer_reviews_seller" | "seller_reviews_buyer">;
}): {
  eligible: boolean;
  role: ActorRole;
  reviewRole: "buyer_reviews_seller" | "seller_reviews_buyer" | null;
  reason: string;
} {
  const role = roleOnTransaction(input.actor, input.transaction);
  if (role === "stranger") {
    return {
      eligible: false,
      role,
      reviewRole: null,
      reason: "Only transaction parties may review",
    };
  }
  if (role === "moderator") {
    return {
      eligible: false,
      role,
      reviewRole: null,
      reason: "Moderators do not leave transaction reviews",
    };
  }

  const reviewRole =
    role === "buyer" ? "buyer_reviews_seller" : "seller_reviews_buyer";
  const subjectId =
    role === "buyer" ? input.transaction.sellerId : input.transaction.buyerId;

  try {
    canAcceptReview({
      transactionStatus: input.transaction.status,
      buyerId: input.transaction.buyerId,
      sellerId: input.transaction.sellerId,
      reviewerId: input.actor.profileId,
      subjectId,
      role: reviewRole,
      existingReview: input.existingReviewRoles.includes(reviewRole),
    });
  } catch (error) {
    return {
      eligible: false,
      role,
      reviewRole,
      reason: error instanceof Error ? error.message : "Not eligible",
    };
  }

  return {
    eligible: true,
    role,
    reviewRole,
    reason: "Eligible to submit a sealed review",
  };
}
