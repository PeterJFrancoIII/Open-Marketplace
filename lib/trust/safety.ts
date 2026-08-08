import type { RequestActor } from "./auth.ts";
import { AuthError, roleOnTransaction } from "./auth.ts";
import {
  assertAppealTransition,
  assertDisputeTransition,
  assertModerationStatusTransition,
  assertReviewReportTransition,
  InvalidTrustTransitionError,
  type AppealStatus,
  type DisputeStatus,
  type ModerationActionStatus,
  type ReviewReportStatus,
} from "./state-machines.ts";
import type { TransactionStatus } from "./types.ts";

/** Public reason categories — never free-text accusations in public surfaces. */
export const PUBLIC_REASON_CATEGORIES = [
  "restricted_item",
  "counterfeit_or_ip",
  "harassment",
  "review_abuse",
  "transaction_bad_faith",
  "policy_other",
] as const;

export type PublicReasonCategory = (typeof PUBLIC_REASON_CATEGORIES)[number];

export const MODERATION_ACTIONS = [
  "warning",
  "listing_restriction",
  "suspend",
  "ban",
  "review_tombstone",
] as const;

export type ModerationActionKind = (typeof MODERATION_ACTIONS)[number];

export type DisputeRecord = {
  id: string;
  transactionId: string;
  openedBy: string;
  status: DisputeStatus;
  reasonCode: PublicReasonCategory;
  summary: string;
  resolutionCode: string | null;
  publicOutcome: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ModerationActionRecord = {
  id: string;
  subjectProfileId: string;
  issuerId: string;
  action: ModerationActionKind;
  ruleCode: PublicReasonCategory;
  publicReason: string;
  status: ModerationActionStatus;
  /** Optional JSON describing scope, e.g. {"listings":"new_only"}. */
  scopeJson: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type AppealRecord = {
  id: string;
  moderationActionId: string;
  appellantId: string;
  status: AppealStatus;
  statement: string;
  decisionPublic: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ReviewReportRecord = {
  id: string;
  reviewId: string;
  reporterId: string;
  reasonCode: PublicReasonCategory;
  status: ReviewReportStatus;
  details: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type TransparencyReport = {
  period: "all_time";
  generatedAt: string;
  disputes: { opened: number; resolved: number; withdrawn: number };
  moderationActions: Record<ModerationActionKind, number>;
  appeals: { opened: number; upheld: number; denied: number; withdrawn: number };
  reviewReports: { opened: number; actioned: number; dismissed: number };
  disclosures: string[];
};

const DISPUTABLE: TransactionStatus[] = ["accepted", "fulfilled", "disputed"];

function nowIso(now: Date): string {
  return now.toISOString();
}

function assertReason(code: string): asserts code is PublicReasonCategory {
  if (!(PUBLIC_REASON_CATEGORIES as readonly string[]).includes(code)) {
    throw new InvalidTrustTransitionError(`Unknown public reason category: ${code}`);
  }
}

function assertAction(action: string): asserts action is ModerationActionKind {
  if (!(MODERATION_ACTIONS as readonly string[]).includes(action)) {
    throw new InvalidTrustTransitionError(`Unknown moderation action: ${action}`);
  }
}

function requireModerator(actor: RequestActor): void {
  if (!actor.isModerator) {
    throw new AuthError("Moderator capability required", 403);
  }
}

/** Refuse transparency/public payloads that embed complainant identity fields. */
export function assertNoComplainantLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (/"openedBy"|"reporterId"|"appellantId"|"issuerId"|"reporterFingerprint"/.test(json)) {
    throw new InvalidTrustTransitionError("Transparency payload must not expose complainants");
  }
}

export function openDispute(input: {
  id: string;
  transaction: {
    id: string;
    buyerId: string;
    sellerId: string;
    status: TransactionStatus;
  };
  actor: RequestActor;
  reasonCode: string;
  summary?: string;
  existingOpenForTx?: boolean;
  now?: Date;
}): DisputeRecord {
  const role = roleOnTransaction(input.actor, input.transaction);
  if (role === "stranger") {
    throw new AuthError("Only buyer or seller may open a dispute", 403);
  }
  if (role !== "moderator" && !DISPUTABLE.includes(input.transaction.status)) {
    throw new InvalidTrustTransitionError(
      "Disputes require an accepted, fulfilled, or already-disputed transaction",
    );
  }
  if (input.existingOpenForTx) {
    throw new InvalidTrustTransitionError("An open dispute already exists for this transaction");
  }
  assertReason(input.reasonCode);
  const stamp = nowIso(input.now ?? new Date());
  return {
    id: input.id,
    transactionId: input.transaction.id,
    openedBy: input.actor.profileId,
    status: "open",
    reasonCode: input.reasonCode,
    summary: (input.summary ?? "").slice(0, 280),
    resolutionCode: null,
    publicOutcome: null,
    createdAt: stamp,
    resolvedAt: null,
  };
}

export function transitionDispute(input: {
  dispute: DisputeRecord;
  actor: RequestActor;
  to: DisputeStatus;
  resolutionCode?: string;
  publicOutcome?: string;
  now?: Date;
}): DisputeRecord {
  assertDisputeTransition(input.dispute.status, input.to);
  const isParty =
    input.actor.profileId === input.dispute.openedBy || input.actor.isModerator;
  if (input.to === "withdrawn") {
    if (input.actor.profileId !== input.dispute.openedBy && !input.actor.isModerator) {
      throw new AuthError("Only the opener or a moderator may withdraw a dispute", 403);
    }
  } else if (input.to === "under_review" || input.to === "resolved") {
    requireModerator(input.actor);
  } else if (!isParty && !input.actor.isModerator) {
    throw new AuthError("Not permitted to update this dispute", 403);
  }

  const stamp = nowIso(input.now ?? new Date());
  return {
    ...input.dispute,
    status: input.to,
    resolutionCode: input.resolutionCode ?? input.dispute.resolutionCode,
    publicOutcome:
      input.publicOutcome !== undefined
        ? input.publicOutcome.slice(0, 280)
        : input.dispute.publicOutcome,
    resolvedAt:
      input.to === "resolved" || input.to === "withdrawn" ? stamp : input.dispute.resolvedAt,
  };
}

export function issueModerationAction(input: {
  id: string;
  actor: RequestActor;
  subjectProfileId: string;
  action: string;
  ruleCode: string;
  publicReason: string;
  scopeJson?: string | null;
  expiresAt?: string | null;
  now?: Date;
}): ModerationActionRecord {
  requireModerator(input.actor);
  assertAction(input.action);
  assertReason(input.ruleCode);
  if (!input.publicReason.trim()) {
    throw new InvalidTrustTransitionError("Public reason is required for moderation actions");
  }
  if (input.subjectProfileId === input.actor.profileId) {
    throw new InvalidTrustTransitionError("Moderators cannot issue actions against themselves");
  }
  if (input.expiresAt) {
    const exp = Date.parse(input.expiresAt);
    if (!Number.isFinite(exp) || exp <= (input.now ?? new Date()).getTime()) {
      throw new InvalidTrustTransitionError("expiresAt must be a future timestamp");
    }
  }
  return {
    id: input.id,
    subjectProfileId: input.subjectProfileId,
    issuerId: input.actor.profileId,
    action: input.action,
    ruleCode: input.ruleCode,
    publicReason: input.publicReason.slice(0, 280),
    status: "active",
    scopeJson: input.scopeJson ?? null,
    expiresAt: input.expiresAt ?? null,
    createdAt: nowIso(input.now ?? new Date()),
  };
}

export function expireModerationAction(input: {
  action: ModerationActionRecord;
  now?: Date;
}): ModerationActionRecord {
  const now = input.now ?? new Date();
  if (input.action.status !== "active") {
    throw new InvalidTrustTransitionError("Only active moderation actions can expire");
  }
  if (!input.action.expiresAt || Date.parse(input.action.expiresAt) > now.getTime()) {
    throw new InvalidTrustTransitionError("Moderation action has not reached expiry");
  }
  assertModerationStatusTransition(input.action.status, "expired");
  return { ...input.action, status: "expired" };
}

export function openAppeal(input: {
  id: string;
  actor: RequestActor;
  action: ModerationActionRecord;
  statement: string;
  existingOpenAppeal?: boolean;
  now?: Date;
}): AppealRecord {
  if (input.actor.profileId !== input.action.subjectProfileId) {
    throw new AuthError("Only the subject of a moderation action may appeal", 403);
  }
  if (input.action.status !== "active") {
    throw new InvalidTrustTransitionError("Only active moderation actions may be appealed");
  }
  if (input.existingOpenAppeal) {
    throw new InvalidTrustTransitionError("An open appeal already exists for this action");
  }
  if (!input.statement.trim() || input.statement.trim().length < 8) {
    throw new InvalidTrustTransitionError("Appeal statement is required");
  }
  return {
    id: input.id,
    moderationActionId: input.action.id,
    appellantId: input.actor.profileId,
    status: "open",
    statement: input.statement.slice(0, 2000),
    decisionPublic: null,
    createdAt: nowIso(input.now ?? new Date()),
    resolvedAt: null,
  };
}

export function decideAppeal(input: {
  appeal: AppealRecord;
  action: ModerationActionRecord;
  actor: RequestActor;
  decision: "upheld" | "denied";
  decisionPublic: string;
  now?: Date;
}): { appeal: AppealRecord; action: ModerationActionRecord } {
  requireModerator(input.actor);
  assertAppealTransition(input.appeal.status, input.decision);
  if (!input.decisionPublic.trim()) {
    throw new InvalidTrustTransitionError("Public decision explanation is required");
  }
  const stamp = nowIso(input.now ?? new Date());
  const appeal: AppealRecord = {
    ...input.appeal,
    status: input.decision,
    decisionPublic: input.decisionPublic.slice(0, 280),
    resolvedAt: stamp,
  };
  let action = input.action;
  if (input.decision === "upheld" && action.status === "active") {
    assertModerationStatusTransition(action.status, "overturned");
    action = { ...action, status: "overturned" };
  }
  return { appeal, action };
}

export function reportReview(input: {
  id: string;
  actor: RequestActor;
  review: { id: string; reviewerId: string; subjectId: string; visibility: string };
  reasonCode: string;
  details?: string;
  alreadyReportedByActor?: boolean;
  now?: Date;
}): ReviewReportRecord {
  if (input.actor.profileId === input.review.reviewerId) {
    throw new InvalidTrustTransitionError("Authors cannot report their own review");
  }
  if (input.review.visibility === "sealed") {
    throw new InvalidTrustTransitionError("Sealed reviews cannot be reported yet");
  }
  if (input.alreadyReportedByActor) {
    throw new InvalidTrustTransitionError("Duplicate review report");
  }
  assertReason(input.reasonCode);
  return {
    id: input.id,
    reviewId: input.review.id,
    reporterId: input.actor.profileId,
    reasonCode: input.reasonCode,
    status: "open",
    details: (input.details ?? "").slice(0, 500),
    createdAt: nowIso(input.now ?? new Date()),
    resolvedAt: null,
  };
}

export function transitionReviewReport(input: {
  report: ReviewReportRecord;
  actor: RequestActor;
  to: ReviewReportStatus;
  now?: Date;
}): ReviewReportRecord {
  requireModerator(input.actor);
  assertReviewReportTransition(input.report.status, input.to);
  const stamp = nowIso(input.now ?? new Date());
  return {
    ...input.report,
    status: input.to,
    resolvedAt: input.to === "actioned" || input.to === "dismissed" ? stamp : null,
  };
}

/** Aggregate counts only — never include reporter/appellant/opener ids or private text. */
export function buildTransparencyReport(input: {
  disputes: DisputeRecord[];
  actions: ModerationActionRecord[];
  appeals: AppealRecord[];
  reports: ReviewReportRecord[];
  now?: Date;
}): TransparencyReport {
  const moderationActions = Object.fromEntries(
    MODERATION_ACTIONS.map((k) => [k, 0]),
  ) as Record<ModerationActionKind, number>;
  for (const action of input.actions) {
    moderationActions[action.action] += 1;
  }

  const report: TransparencyReport = {
    period: "all_time",
    generatedAt: nowIso(input.now ?? new Date()),
    disputes: {
      opened: input.disputes.length,
      resolved: input.disputes.filter((d) => d.status === "resolved").length,
      withdrawn: input.disputes.filter((d) => d.status === "withdrawn").length,
    },
    moderationActions,
    appeals: {
      opened: input.appeals.length,
      upheld: input.appeals.filter((a) => a.status === "upheld").length,
      denied: input.appeals.filter((a) => a.status === "denied").length,
      withdrawn: input.appeals.filter((a) => a.status === "withdrawn").length,
    },
    reviewReports: {
      opened: input.reports.length,
      actioned: input.reports.filter((r) => r.status === "actioned").length,
      dismissed: input.reports.filter((r) => r.status === "dismissed").length,
    },
    disclosures: [
      "Counts are aggregate only.",
      "Complainant identities and private statements are not published.",
      "Every adverse automated or moderator decision has an appeal path.",
      "Social popularity is never used in enforcement ranking.",
    ],
  };

  const serialized = JSON.stringify(report);
  if (
    /openedBy|reporterId|appellantId|issuerId|statement|details|summary/.test(serialized)
  ) {
    // Field names in disclosures/counts are fine; private values must not appear.
    // Ensure no profile-like ids leaked via accidental inclusion.
  }
  if (/"openedBy"|"reporterId"|"appellantId"|"issuerId"/.test(serialized)) {
    throw new InvalidTrustTransitionError("Transparency report leaked private identity fields");
  }
  assertNoComplainantLeak(report);
  return report;
}

/** Public view of a moderation action — no issuer internals beyond rule/reason. */
export function toPublicModerationView(action: ModerationActionRecord): {
  id: string;
  subjectProfileId: string;
  action: ModerationActionKind;
  ruleCode: PublicReasonCategory;
  publicReason: string;
  status: ModerationActionStatus;
  expiresAt: string | null;
  createdAt: string;
} {
  return {
    id: action.id,
    subjectProfileId: action.subjectProfileId,
    action: action.action,
    ruleCode: action.ruleCode,
    publicReason: action.publicReason,
    status: action.status,
    expiresAt: action.expiresAt,
    createdAt: action.createdAt,
  };
}
