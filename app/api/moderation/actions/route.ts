import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { moderationActions, profiles } from "../../../../db/schema";
import {
  AuthError,
  InvalidTrustTransitionError,
  issueModerationAction,
  parseActor,
  rateLimit,
  toPublicModerationView,
  type ModerationActionStatus,
} from "../../../../lib/trust";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof InvalidTrustTransitionError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  return Response.json({ error: "registry_error", message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const subjectProfileId = url.searchParams.get("subjectProfileId")?.trim();
    if (!subjectProfileId) {
      return Response.json({ error: "subjectProfileId is required" }, { status: 400 });
    }
    parseActor(request, process.env.MODERATOR_TOKEN ?? null);

    const db = await getDb();
    const rows = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.subjectProfileId, subjectProfileId))
      .limit(50);

    return Response.json({
      actions: rows.map((row) =>
        toPublicModerationView({
          id: row.id,
          subjectProfileId: row.subjectProfileId,
          issuerId: row.issuerId,
          action: row.action as never,
          ruleCode: row.ruleCode as never,
          publicReason: row.publicReason,
          status: (row.status ?? "active") as ModerationActionStatus,
          scopeJson: row.scopeJson,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        }),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `moderation:issue:${actor.profileId}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      subjectProfileId?: string;
      action?: string;
      ruleCode?: string;
      publicReason?: string;
      scopeJson?: string;
      expiresAt?: string;
    };
    if (!body.subjectProfileId || !body.action || !body.ruleCode || !body.publicReason) {
      return Response.json(
        { error: "subjectProfileId, action, ruleCode, and publicReason are required" },
        { status: 400 },
      );
    }

    const record = issueModerationAction({
      id: `mod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      actor,
      subjectProfileId: body.subjectProfileId,
      action: body.action,
      ruleCode: body.ruleCode,
      publicReason: body.publicReason,
      scopeJson: body.scopeJson,
      expiresAt: body.expiresAt,
    });

    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db
      .insert(profiles)
      .values({
        id: body.subjectProfileId,
        displayName: `User ${body.subjectProfileId.slice(0, 8)}`,
        updatedAt,
      })
      .onConflictDoUpdate({ target: profiles.id, set: { updatedAt } });

    await db.insert(moderationActions).values({
      id: record.id,
      subjectProfileId: record.subjectProfileId,
      issuerId: record.issuerId,
      action: record.action,
      ruleCode: record.ruleCode,
      publicReason: record.publicReason,
      status: record.status,
      scopeJson: record.scopeJson,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    });

    return Response.json({ action: toPublicModerationView(record) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
