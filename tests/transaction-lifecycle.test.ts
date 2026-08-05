import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTransactionEvent,
  actorFromProfileId,
  createProposedTransaction,
  InvalidTrustTransitionError,
  mintSessionToken,
  parseActor,
  rateLimit,
  resetRateLimits,
  reviewEligibility,
  roleOnTransaction,
  fingerprintPayload,
  recallIdempotent,
  rememberIdempotent,
  resetIdempotency,
} from "../lib/trust/index.ts";

const SESSION_SECRET = "test-session-secret-32-chars-min!!";

function actor(profileId: string, isModerator = false) {
  return actorFromProfileId(profileId, isModerator);
}

test("authorization roles: buyer seller stranger moderator", () => {
  const tx = { buyerId: "buyer-1", sellerId: "seller-1" };
  assert.equal(roleOnTransaction(actor("buyer-1"), tx), "buyer");
  assert.equal(roleOnTransaction(actor("seller-1"), tx), "seller");
  assert.equal(roleOnTransaction(actor("other"), tx), "stranger");
  assert.equal(roleOnTransaction(actor("mod", true), tx), "moderator");
});

test("parseActor requires server session (rejects header-only)", async () => {
  await assert.rejects(
    () => parseActor(new Request("http://x"), null, SESSION_SECRET),
    /session required/i,
  );
  await assert.rejects(
    () =>
      parseActor(
        new Request("http://x", { headers: { "x-profile-id": "device:abcdef12" } }),
        null,
        SESSION_SECRET,
      ),
    /session required/i,
  );
  const token = await mintSessionToken("device:abcdef12", SESSION_SECRET);
  const a = await parseActor(
    new Request("http://x", { headers: { authorization: `Session ${token}` } }),
    null,
    SESSION_SECRET,
  );
  assert.equal(a.profileId, "device:abcdef12");
});

test("stranger cannot accept or confirm meetup", () => {
  let tx = createProposedTransaction({
    id: "t1",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: tx,
        actor: actor("stranger"),
        event: { type: "accept" },
      }),
    InvalidTrustTransitionError,
  );

  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "accept" },
  }).transaction;

  const issued = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "issue_meetup_nonce" },
  });
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: issued.transaction,
        actor: actor("stranger"),
        event: {
          type: "confirm_meetup",
          meetupNonce: issued.transaction.meetupNonce ?? undefined,
        },
      }),
    /Stranger/,
  );
});

test("neither party can complete both meetup sides", () => {
  let tx = createProposedTransaction({
    id: "t2",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "accept" },
  }).transaction;
  const issued = applyTransactionEvent({
    transaction: tx,
    actor: actor("buyer-1"),
    event: { type: "issue_meetup_nonce" },
  }).transaction;
  const nonce = issued.meetupNonce!;

  const buyerConfirm = applyTransactionEvent({
    transaction: issued,
    actor: actor("buyer-1"),
    event: { type: "confirm_meetup", meetupNonce: nonce },
  }).transaction;
  assert.ok(buyerConfirm.buyerConfirmedAt);
  assert.equal(buyerConfirm.sellerConfirmedAt, null);

  // Buyer cannot set seller confirmation by replaying as buyer
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: buyerConfirm,
        actor: actor("buyer-1"),
        event: { type: "confirm_meetup", meetupNonce: nonce },
      }),
    /already confirmed/,
  );

  const both = applyTransactionEvent({
    transaction: buyerConfirm,
    actor: actor("seller-1"),
    event: { type: "confirm_meetup", meetupNonce: nonce },
  }).transaction;
  assert.ok(both.buyerConfirmedAt);
  assert.ok(both.sellerConfirmedAt);
  assert.equal(both.status, "review_window");
  assert.ok(both.completedAt);
  assert.ok(both.reviewDeadlineAt);
});

test("canceled transactions are not review-eligible", () => {
  let tx = createProposedTransaction({
    id: "t3",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("seller-1"),
    event: { type: "cancel" },
  }).transaction;
  const eligibility = reviewEligibility({
    transaction: tx,
    actor: actor("buyer-1"),
    existingReviewRoles: [],
  });
  assert.equal(eligibility.eligible, false);
  assert.match(eligibility.reason, /completed/i);
});

test("moderator may cancel; cannot leave reviews", () => {
  let tx = createProposedTransaction({
    id: "t4",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actor("mod", true),
    event: { type: "cancel", reason: "policy" },
  }).transaction;
  assert.equal(tx.status, "canceled");
  const eligibility = reviewEligibility({
    transaction: tx,
    actor: actor("mod", true),
    existingReviewRoles: [],
  });
  assert.equal(eligibility.eligible, false);
  assert.match(eligibility.reason, /Moderators/i);
});

test("buyer cannot accept own offer; only seller accepts", () => {
  const tx = createProposedTransaction({
    id: "t5",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: tx,
        actor: actor("buyer-1"),
        event: { type: "accept" },
      }),
    /seller may accept/i,
  );
});

test("rate limit and idempotency helpers", () => {
  resetRateLimits();
  resetIdempotency();
  assert.equal(rateLimit({ key: "k", limit: 2, windowMs: 1000 }).ok, true);
  assert.equal(rateLimit({ key: "k", limit: 2, windowMs: 1000 }).ok, true);
  assert.equal(rateLimit({ key: "k", limit: 2, windowMs: 1000 }).ok, false);

  const fp = fingerprintPayload({ a: 1 });
  rememberIdempotent({ key: "id1", fingerprint: fp, body: { ok: true }, status: 201 });
  const hit = recallIdempotent({ key: "id1", fingerprint: fp });
  assert.equal(hit.hit, true);
  if (hit.hit) assert.equal(hit.conflict, false);
  const conflict = recallIdempotent({ key: "id1", fingerprint: "other" });
  assert.equal(conflict.hit, true);
  if (conflict.hit) assert.equal(conflict.conflict, true);
});

test("completed two-party flow unlocks review eligibility", () => {
  let tx = createProposedTransaction({
    id: "t6",
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

  const buyer = reviewEligibility({
    transaction: tx,
    actor: actor("buyer-1"),
    existingReviewRoles: [],
  });
  const seller = reviewEligibility({
    transaction: tx,
    actor: actor("seller-1"),
    existingReviewRoles: [],
  });
  const stranger = reviewEligibility({
    transaction: tx,
    actor: actor("nope"),
    existingReviewRoles: [],
  });
  assert.equal(buyer.eligible, true);
  assert.equal(seller.eligible, true);
  assert.equal(stranger.eligible, false);
});
