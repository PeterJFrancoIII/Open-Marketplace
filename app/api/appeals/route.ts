import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { appeals, moderationActions, profiles } from "../../../db/schema";
import {
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  type AppealStatus,
  type ModerationActionStatus,
} from "../../../lib/trust";
import {
  openAppeal,
} from "../../../lib/trust/safety.ts";

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

export async function POST(request: Request) {
  try {
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `appeals:open:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      moderationActionId?: string;
      statement?: string;
    };
    if (!body.moderationActionId || !body.statement) {
      return Response.json(
        { error: "moderationActionId and statement are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [action] = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.id, body.moderationActionId))
      .limit(1);
    if (!action) {
      return Response.json({ error: "Moderation action not found" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(appeals)
      .where(
        and(
          eq(appeals.moderationActionId, action.id),
          or(eq(appeals.status, "open"), eq(appeals.status, "under_review")),
        ),
      )
      .limit(1);

    const record = openAppeal({
      id: `appeal_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      actor,
      action: {
        id: action.id,
        subjectProfileId: action.subjectProfileId,
        issuerId: action.issuerId,
        action: action.action as never,
        ruleCode: action.ruleCode as never,
        publicReason: action.publicReason,
        status: (action.status ?? "active") as ModerationActionStatus,
        scopeJson: action.scopeJson,
        expiresAt: action.expiresAt,
        createdAt: action.createdAt,
      },
      statement: body.statement,
      existingOpenAppeal: Boolean(existing),
    });

    const updatedAt = new Date().toISOString();
    await db
      .insert(profiles)
      .values({
        id: actor.profileId,
        displayName: `User ${actor.profileId.slice(0, 8)}`,
        updatedAt,
      })
      .onConflictDoUpdate({ target: profiles.id, set: { updatedAt } });

    await db.insert(appeals).values({
      id: record.id,
      moderationActionId: record.moderationActionId,
      appellantId: record.appellantId,
      status: record.status,
      statement: record.statement,
      decisionPublic: record.decisionPublic,
      createdAt: record.createdAt,
      resolvedAt: record.resolvedAt,
    });

    return Response.json(
      {
        appeal: {
          id: record.id,
          moderationActionId: record.moderationActionId,
          status: record.status as AppealStatus,
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
