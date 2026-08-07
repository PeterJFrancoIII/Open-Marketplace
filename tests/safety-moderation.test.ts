import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthError,
  assertAppealTransition,
  assertDisputeTransition,
  InvalidTrustTransitionError,
} from "../lib/trust/index.ts";
import {
  buildTransparencyReport,
  decideAppeal,
  expireModerationAction,
  issueModerationAction,
  openAppeal,
  openDispute,
  reportReview,
  toPublicModerationView,
  transitionDispute,
  transitionReviewReport,
} from "../lib/trust/safety.ts";

function actor(profileId: string, isModerator = false) {
  return { profileId, isModerator };
}

const tx = {
  id: "tx1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  status: "accepted" as const,
};

test("dispute transitions reject illegal moves", () => {
  assert.throws(() => assertDisputeTransition("resolved", "open"), InvalidTrustTransitionError);
  assert.doesNotThrow(() => assertDisputeTransition("open", "under_review"));
});

test("stranger cannot open dispute; parties can", () => {
  assert.throws(
    () =>
      openDispute({
        id: "d1",
        transaction: tx,
        actor: actor("stranger"),
        reasonCode: "transaction_bad_faith",
      }),
    AuthError,
  );
  const dispute = openDispute({
    id: "d1",
    transaction: tx,
    actor: actor("buyer-1"),
    reasonCode: "transaction_bad_faith",
    summary: "No-show at meetup",
  });
  assert.equal(dispute.status, "open");
  assert.equal(dispute.openedBy, "buyer-1");
});

test("only moderator resolves disputes; opener may withdraw", () => {
  const dispute = openDispute({
    id: "d2",
    transaction: tx,
    actor: actor("seller-1"),
    reasonCode: "harassment",
  });
  assert.throws(
    () =>
      transitionDispute({
        dispute,
        actor: actor("buyer-1"),
        to: "resolved",
        publicOutcome: "Resolved in favor of neither",
      }),
    AuthError,
  );
  const withdrawn = transitionDispute({
    dispute,
    actor: actor("seller-1"),
    to: "withdrawn",
  });
  assert.equal(withdrawn.status, "withdrawn");
  assert.ok(withdrawn.resolvedAt);

  const openAgain = openDispute({
    id: "d3",
    transaction: { ...tx, status: "fulfilled" },
    actor: actor("buyer-1"),
    reasonCode: "policy_other",
  });
  const resolved = transitionDispute({
    dispute: openAgain,
    actor: actor("mod-1", true),
    to: "resolved",
    resolutionCode: "no_violation",
    publicOutcome: "No policy violation found",
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.publicOutcome, "No policy violation found");
});

test("moderation actions require moderator, public reason, and support expiry", () => {
  assert.throws(
    () =>
      issueModerationAction({
        id: "m1",
        actor: actor("buyer-1"),
        subjectProfileId: "seller-1",
        action: "warning",
        ruleCode: "restricted_item",
        publicReason: "Listed a restricted item",
      }),
    AuthError,
  );

  const future = new Date(Date.now() + 86_400_000).toISOString();
  const action = issueModerationAction({
    id: "m1",
    actor: actor("mod-1", true),
    subjectProfileId: "seller-1",
    action: "listing_restriction",
    ruleCode: "restricted_item",
    publicReason: "Temporary restriction on new listings",
    scopeJson: JSON.stringify({ listings: "new_only" }),
    expiresAt: future,
  });
  assert.equal(action.status, "active");
  assert.throws(
    () => expireModerationAction({ action, now: new Date() }),
    /not reached expiry/i,
  );
  const expired = expireModerationAction({
    action,
    now: new Date(Date.parse(future) + 1000),
  });
  assert.equal(expired.status, "expired");
});

test("appeals: subject only; uphold overturns action; stranger denied", () => {
  const action = issueModerationAction({
    id: "m2",
    actor: actor("mod-1", true),
    subjectProfileId: "seller-1",
    action: "suspend",
    ruleCode: "harassment",
    publicReason: "Account suspended pending review",
  });
  assert.throws(
    () =>
      openAppeal({
        id: "a1",
        actor: actor("buyer-1"),
        action,
        statement: "I disagree with this action",
      }),
    AuthError,
  );
  const appeal = openAppeal({
    id: "a1",
    actor: actor("seller-1"),
    action,
    statement: "I disagree with this action and request review",
  });
  assert.equal(appeal.status, "open");

  assert.throws(() => assertAppealTransition("upheld", "open"), InvalidTrustTransitionError);

  const decided = decideAppeal({
    appeal,
    action,
    actor: actor("mod-2", true),
    decision: "upheld",
    decisionPublic: "Suspension overturned after review",
  });
  assert.equal(decided.appeal.status, "upheld");
  assert.equal(decided.action.status, "overturned");
});

test("review reports block self-report, sealed reviews, and duplicates", () => {
  assert.throws(
    () =>
      reportReview({
        id: "r1",
        actor: actor("buyer-1"),
        review: {
          id: "rev1",
          reviewerId: "buyer-1",
          subjectId: "seller-1",
          visibility: "revealed",
        },
        reasonCode: "review_abuse",
      }),
    /own review/i,
  );
  assert.throws(
    () =>
      reportReview({
        id: "r1",
        actor: actor("seller-1"),
        review: {
          id: "rev1",
          reviewerId: "buyer-1",
          subjectId: "seller-1",
          visibility: "sealed",
        },
        reasonCode: "review_abuse",
      }),
    /sealed/i,
  );
  const report = reportReview({
    id: "r1",
    actor: actor("seller-1"),
    review: {
      id: "rev1",
      reviewerId: "buyer-1",
      subjectId: "seller-1",
      visibility: "revealed",
    },
    reasonCode: "review_abuse",
    details: "Looks like feedback trading",
  });
  assert.equal(report.status, "open");
  const actioned = transitionReviewReport({
    report,
    actor: actor("mod-1", true),
    to: "actioned",
  });
  assert.equal(actioned.status, "actioned");
});

test("transparency aggregates never expose complainants or private text", () => {
  const dispute = openDispute({
    id: "d9",
    transaction: tx,
    actor: actor("buyer-1"),
    reasonCode: "transaction_bad_faith",
    summary: "SECRET_SUMMARY_SHOULD_NOT_LEAK",
  });
  const action = issueModerationAction({
    id: "m9",
    actor: actor("mod-1", true),
    subjectProfileId: "seller-1",
    action: "warning",
    ruleCode: "policy_other",
    publicReason: "Public warning only",
  });
  const appeal = openAppeal({
    id: "a9",
    actor: actor("seller-1"),
    action,
    statement: "PRIVATE_APPEAL_STATEMENT",
  });
  const report = reportReview({
    id: "rr9",
    actor: actor("seller-1"),
    review: {
      id: "rev9",
      reviewerId: "buyer-1",
      subjectId: "seller-1",
      visibility: "revealed",
    },
    reasonCode: "review_abuse",
    details: "PRIVATE_REPORT_DETAILS",
  });

  const transparency = buildTransparencyReport({
    disputes: [dispute],
    actions: [action],
    appeals: [appeal],
    reports: [report],
  });
  const json = JSON.stringify(transparency);
  assert.equal(transparency.disputes.opened, 1);
  assert.equal(transparency.moderationActions.warning, 1);
  assert.equal(transparency.appeals.opened, 1);
  assert.doesNotMatch(json, /buyer-1|seller-1|mod-1|SECRET_|PRIVATE_/);
  assert.doesNotMatch(json, /openedBy|reporterId|appellantId|issuerId/);

  const publicView = toPublicModerationView(action);
  assert.equal(publicView.publicReason, "Public warning only");
  assert.equal("issuerId" in publicView, false);
});
