import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTransactionEvent,
  createProposedTransaction,
} from "../lib/trust/transactions.ts";
import {
  addPublicResponse,
  applyReveal,
  createSealedReview,
  editSealedReview,
  filterRepeatCounterparties,
  projectRoleReputation,
  resolveReveal,
  toPublicReviewView,
  tombstoneReview,
  type ReviewRecord,
} from "../lib/trust/reviews.ts";

function actor(profileId: string, isModerator = false) {
  return { profileId, isModerator };
}

function completedTx() {
  let tx = createProposedTransaction({
    id: "tx-1",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "accept" },
  }).transaction;
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "issue_meetup_nonce" },
  }).transaction;
  const nonce = tx.meetupNonce!;
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("buyer-1"),
    event: { type: "confirm_meetup", meetupNonce: nonce },
  }).transaction;
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "confirm_meetup", meetupNonce: nonce },
  }).transaction;
  return tx;
}

test("double-blind: counterparty cannot see sealed review content", () => {
  const tx = completedTx();
  const buyerReview = createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 5,
    body: "Great meetup",
    dimensions: [
      { dimension: "communication", score: 5 },
      { dimension: "fulfillment", score: 5 },
      { dimension: "item_matched_description", boolValue: true },
    ],
    existingRoles: [],
  });
  assert.equal(buyerReview.visibility, "sealed");

  const sellerView = toPublicReviewView({
    review: buyerReview,
    viewer: actor("seller-1"),
    reviewDeadlineAt: tx.reviewDeadlineAt,
  });
  assert.equal(sellerView.overallScore, null);
  assert.equal(sellerView.body, null);
  assert.equal(sellerView.sealedExists, true);
  assert.ok(sellerView.reviewDeadlineAt);

  const authorView = toPublicReviewView({
    review: buyerReview,
    viewer: actor("buyer-1"),
    reviewDeadlineAt: tx.reviewDeadlineAt,
  });
  assert.equal(authorView.overallScore, 5);
  assert.equal(authorView.body, "Great meetup");
});

test("both sealed reviews reveal together", () => {
  const tx = completedTx();
  const buyerReview = createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 4,
    existingRoles: [],
  });
  const sellerReview = createSealedReview({
    id: "r2",
    transaction: tx,
    actor: actor("seller-1"),
    overallScore: 5,
    dimensions: [{ dimension: "communication", score: 5 }],
    existingRoles: ["buyer_reviews_seller"],
  });
  const decision = resolveReveal({
    reviews: [buyerReview, sellerReview],
    completedAt: tx.completedAt,
    reviewDeadlineAt: tx.reviewDeadlineAt,
  });
  assert.equal(decision.reason, "both_submitted");
  assert.deepEqual(decision.revealIds.sort(), ["r1", "r2"]);
  const revealed = applyReveal([buyerReview, sellerReview], decision.revealIds);
  assert.equal(revealed.every((r) => r.visibility === "revealed"), true);

  const sellerSeesBuyer = toPublicReviewView({
    review: revealed.find((r) => r.id === "r1")!,
    viewer: actor("seller-1"),
    reviewDeadlineAt: tx.reviewDeadlineAt,
  });
  assert.equal(sellerSeesBuyer.overallScore, 4);
});

test("deadline reveal without both reviews", () => {
  const tx = completedTx();
  const buyerReview = createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 3,
    existingRoles: [],
  });
  const afterDeadline = new Date(tx.reviewDeadlineAt!);
  afterDeadline.setUTCDate(afterDeadline.getUTCDate() + 1);
  const decision = resolveReveal({
    reviews: [buyerReview],
    completedAt: tx.completedAt,
    reviewDeadlineAt: tx.reviewDeadlineAt,
    now: afterDeadline,
  });
  assert.equal(decision.reason, "deadline");
  assert.deepEqual(decision.revealIds, ["r1"]);
});

test("late duplicate self and stranger reviews fail", () => {
  const tx = completedTx();
  createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 5,
    existingRoles: [],
  });
  assert.throws(
    () =>
      createSealedReview({
        id: "r2",
        transaction: tx,
        actor: actor("buyer-1"),
        overallScore: 4,
        existingRoles: ["buyer_reviews_seller"],
      }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      createSealedReview({
        id: "r3",
        transaction: tx,
        actor: actor("stranger"),
        overallScore: 5,
        existingRoles: [],
      }),
    /parties may review/,
  );

  const openOnly = createProposedTransaction({
    id: "tx-open",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  assert.throws(
    () =>
      createSealedReview({
        id: "r4",
        transaction: openOnly,
        actor: actor("buyer-1"),
        overallScore: 5,
        existingRoles: [],
      }),
    /completed/,
  );
});

test("sealed edits allowed; revealed immutable via edit path", () => {
  const tx = completedTx();
  const review = createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 4,
    body: "ok",
    existingRoles: [],
  });
  const edited = editSealedReview({
    review,
    actor: actor("buyer-1"),
    overallScore: 5,
    body: "great",
  });
  assert.equal(edited.overallScore, 5);
  const revealed = applyReveal([edited], ["r1"])[0]!;
  assert.throws(
    () =>
      editSealedReview({
        review: revealed,
        actor: actor("buyer-1"),
        body: "nope",
      }),
    /sealed/,
  );
});

test("public response and tombstone preserve audit trail", () => {
  const tx = completedTx();
  let review = createSealedReview({
    id: "r1",
    transaction: tx,
    actor: actor("buyer-1"),
    overallScore: 5,
    existingRoles: [],
  });
  review = applyReveal([review], ["r1"])[0]!;
  const response = addPublicResponse({
    review,
    actor: actor("seller-1"),
    body: "Thanks for the kind review",
    existingResponse: false,
  });
  assert.equal(response.authorId, "seller-1");
  assert.throws(
    () =>
      addPublicResponse({
        review,
        actor: actor("seller-1"),
        body: "Again",
        existingResponse: true,
      }),
    /one public response/,
  );

  const tombstoned = tombstoneReview({
    review,
    actor: actor("mod", true),
    reasonCode: "prohibited_personal_information",
  });
  assert.equal(tombstoned.visibility, "removed");
  assert.match(tombstoned.removedReason ?? "", /prohibited personal information/);
  const publicView = toPublicReviewView({
    review: tombstoned,
    viewer: actor("buyer-1"),
    reviewDeadlineAt: tx.reviewDeadlineAt,
  });
  assert.equal(publicView.body, null);
  assert.ok(publicView.removedReason);
});

test("Bayesian projections use revealed reviews with counts", () => {
  const base: ReviewRecord[] = Array.from({ length: 4 }, (_, i) => ({
    id: `r${i}`,
    transactionId: `t${i}`,
    reviewerId: `buyer-${i}`,
    subjectId: "seller-1",
    role: "buyer_reviews_seller" as const,
    visibility: "revealed" as const,
    overallScore: 5,
    body: "",
    dimensions: [],
    revealedAt: `2026-07-0${i + 1}T00:00:00.000Z`,
    removedReason: null,
    createdAt: `2026-07-0${i + 1}T00:00:00.000Z`,
    updatedAt: `2026-07-0${i + 1}T00:00:00.000Z`,
  }));
  const proj = projectRoleReputation({
    profileId: "seller-1",
    memberSince: "2024-01-01T00:00:00.000Z",
    role: "seller",
    reviews: base,
    completedCount: 4,
  });
  assert.ok("seller" in proj);
  assert.equal(proj.seller.ratingCount, 4);
  assert.ok(proj.seller.displayMean !== null);
  assert.equal(proj.experienceLabel, "Active");
});

test("repeat counterparty reviews collapse in public aggregates", () => {
  const reviews: ReviewRecord[] = [
    {
      id: "r1",
      transactionId: "t1",
      reviewerId: "buyer-1",
      subjectId: "seller-1",
      role: "buyer_reviews_seller",
      visibility: "revealed",
      overallScore: 5,
      body: "",
      dimensions: [],
      revealedAt: "2026-08-01T00:00:00.000Z",
      removedReason: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "r2",
      transactionId: "t2",
      reviewerId: "buyer-1",
      subjectId: "seller-1",
      role: "buyer_reviews_seller",
      visibility: "revealed",
      overallScore: 1,
      body: "",
      dimensions: [],
      revealedAt: "2026-08-10T00:00:00.000Z",
      removedReason: null,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    },
  ];
  const filtered = filterRepeatCounterparties(reviews, 30);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "r1");
});
