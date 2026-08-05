import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTransactionTransition,
  canAcceptReview,
  canEditReview,
  createMemoryTrustEventStore,
  InvalidTrustTransitionError,
  nextLinkHealth,
  rebuildSellerProjection,
  reviewRevealAt,
  trustFixtures,
  bayesianDisplayMean,
  wilsonLowerBound,
} from "../lib/trust/index.ts";

test("transaction transitions reject illegal moves", () => {
  assert.throws(
    () => assertTransactionTransition("proposed", "completed"),
    InvalidTrustTransitionError,
  );
  assert.doesNotThrow(() => assertTransactionTransition("proposed", "accepted"));
  assert.doesNotThrow(() => assertTransactionTransition("fulfilled", "completed"));
});

test("reviews require completed transaction and correct roles", () => {
  assert.throws(
    () =>
      canAcceptReview({
        transactionStatus: "accepted",
        buyerId: "b",
        sellerId: "s",
        reviewerId: "b",
        subjectId: "s",
        role: "buyer_reviews_seller",
        existingReview: false,
      }),
    /completed/,
  );

  assert.doesNotThrow(() =>
    canAcceptReview({
      transactionStatus: "completed",
      buyerId: "b",
      sellerId: "s",
      reviewerId: "b",
      subjectId: "s",
      role: "buyer_reviews_seller",
      existingReview: false,
    }),
  );

  assert.throws(
    () =>
      canAcceptReview({
        transactionStatus: "completed",
        buyerId: "b",
        sellerId: "s",
        reviewerId: "b",
        subjectId: "s",
        role: "buyer_reviews_seller",
        existingReview: true,
      }),
    /Duplicate/,
  );
});

test("sealed reviews only are editable", () => {
  assert.doesNotThrow(() => canEditReview("sealed"));
  assert.throws(() => canEditReview("revealed"), InvalidTrustTransitionError);
});

test("unknown link health is not treated as dead", () => {
  const temporary = nextLinkHealth("live", "temporary_failure");
  assert.equal(temporary.status, "unknown");

  const firstFail = nextLinkHealth("live", "definitive_failure", 0);
  assert.notEqual(firstFail.status, "action_required");

  const confirmed = nextLinkHealth("unknown", "definitive_failure_confirmed", 1);
  assert.equal(confirmed.status, "dead");

  const grace = nextLinkHealth("dead", "grace_notice", 2);
  assert.equal(grace.status, "action_required");
});

test("14-day double-blind reveal deadline", () => {
  const completed = new Date("2026-08-01T00:00:00.000Z");
  assert.equal(
    reviewRevealAt(completed, false, new Date("2026-08-10T00:00:00.000Z")),
    null,
  );
  const late = reviewRevealAt(
    completed,
    false,
    new Date("2026-08-15T00:00:00.000Z"),
  );
  assert.ok(late);
  assert.equal(late.toISOString(), "2026-08-15T00:00:00.000Z");
  assert.ok(reviewRevealAt(completed, true, new Date("2026-08-02T00:00:00.000Z")));
});

test("bayesian projection hides precise mean below three reviews", () => {
  const rebuilt = rebuildSellerProjection({
    profileId: "p1",
    memberSince: "2026-01-01T00:00:00.000Z",
    ratings: [5, 5],
    marketplaceMean: 4.5,
    completedSales: 2,
    recent12MonthRatings: [5, 5],
    calculatedAt: "2026-08-05T00:00:00.000Z",
  });
  assert.equal(rebuilt.seller.displayMean, null);
  assert.equal(rebuilt.seller.ratingCount, 2);
  assert.equal(rebuilt.experienceLabel, "New");

  const mature = bayesianDisplayMean([5, 5, 4, 5], 4.5);
  assert.equal(mature.ratingCount, 4);
  assert.ok(mature.displayMean !== null);
  assert.ok((wilsonLowerBound(9, 10) ?? 0) < 0.95);
});

test("append-only trust events chain by payload hash", async () => {
  const store = createMemoryTrustEventStore();
  const first = await Promise.resolve(
    store.append({
      eventId: "e1",
      subjectProfileId: "p1",
      eventType: "profile.created",
      occurredAt: "2026-08-01T00:00:00.000Z",
      payload: { standing: "new" },
      schemaVersion: 1,
      registryId: "test",
    }),
  );
  const second = await Promise.resolve(
    store.append({
      eventId: "e2",
      subjectProfileId: "p1",
      eventType: "social.link_checked",
      occurredAt: "2026-08-02T00:00:00.000Z",
      payload: { status: "live" },
      schemaVersion: 1,
      registryId: "test",
    }),
  );
  assert.equal(second.priorEventHash, first.payloadHash);
  assert.equal(store.listForSubject("p1").length, 2);
});

test("fixtures cover standing variants without a universal score", () => {
  const cards = [
    trustFixtures.newSeller(),
    trustFixtures.activeSeller(),
    trustFixtures.establishedSeller(),
    trustFixtures.socialActionRequired(),
    trustFixtures.suspended(),
  ];
  for (const card of cards) {
    assert.ok(card.facets.standing);
    assert.ok(Array.isArray(card.disclosures));
    assert.equal("trustScore" in card, false);
    assert.equal("trustScore" in card.facets, false);
  }
  assert.equal(trustFixtures.socialActionRequired().facets.standing, "social_action_required");
  assert.equal(trustFixtures.suspended().facets.standing, "suspended");
  assert.equal(trustFixtures.establishedSeller().facets.experienceLabel, "Established");
});
