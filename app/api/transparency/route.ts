import { getDb } from "../../../db";
import { appeals, disputes, moderationActions, reviewReports } from "../../../db/schema";
import {
  buildTransparencyReport,
  rateLimit,
  type AppealStatus,
  type DisputeRecord,
  type ModerationActionRecord,
  type ReviewReportRecord,
} from "../../../lib/trust";

export async function GET(request: Request) {
  try {
    const limited = rateLimit({
      key: `transparency:read:${request.headers.get("cf-connecting-ip") ?? "anon"}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const db = await getDb();
    const [disputeRows, actionRows, appealRows, reportRows] = await Promise.all([
      db.select().from(disputes).limit(5000),
      db.select().from(moderationActions).limit(5000),
      db.select().from(appeals).limit(5000),
      db.select().from(reviewReports).limit(5000),
    ]);

    const report = buildTransparencyReport({
      disputes: disputeRows.map(
        (d): DisputeRecord => ({
          id: d.id,
          transactionId: d.transactionId,
          openedBy: d.openedBy,
          status: d.status as DisputeRecord["status"],
          reasonCode: d.reasonCode as DisputeRecord["reasonCode"],
          summary: d.summary,
          resolutionCode: d.resolutionCode,
          publicOutcome: d.publicOutcome,
          createdAt: d.createdAt,
          resolvedAt: d.resolvedAt,
        }),
      ),
      actions: actionRows.map(
        (a): ModerationActionRecord => ({
          id: a.id,
          subjectProfileId: a.subjectProfileId,
          issuerId: a.issuerId,
          action: a.action as ModerationActionRecord["action"],
          ruleCode: a.ruleCode as ModerationActionRecord["ruleCode"],
          publicReason: a.publicReason,
          status: (a.status ?? "active") as ModerationActionRecord["status"],
          scopeJson: a.scopeJson,
          expiresAt: a.expiresAt,
          createdAt: a.createdAt,
        }),
      ),
      appeals: appealRows.map((a) => ({
        id: a.id,
        moderationActionId: a.moderationActionId,
        appellantId: a.appellantId,
        status: a.status as AppealStatus,
        statement: a.statement,
        decisionPublic: a.decisionPublic,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
      })),
      reports: reportRows.map(
        (r): ReviewReportRecord => ({
          id: r.id,
          reviewId: r.reviewId,
          reporterId: r.reporterId,
          reasonCode: r.reasonCode as ReviewReportRecord["reasonCode"],
          status: r.status as ReviewReportRecord["status"],
          details: r.details,
          createdAt: r.createdAt,
          resolvedAt: r.resolvedAt,
        }),
      ),
    });

    return Response.json(report, {
      headers: {
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected registry error";
    const unavailable = message.includes("no such table") || message.includes("binding `DB`");
    return Response.json(
      {
        error: unavailable ? "registry_unavailable" : "registry_error",
        message: unavailable
          ? "Transparency metrics are unavailable until the registry is initialized."
          : message,
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
