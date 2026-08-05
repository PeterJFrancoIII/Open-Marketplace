import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { appeals, moderationActions } from "../../../../../db/schema";
import {
  AuthError,
  decideAppeal,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  type AppealStatus,
  type ModerationActionStatus,
} from "../../../../../lib/trust";

type Params = { params: Promise<{ id: string }> };

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

export async function POST(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `appeals:decide:${actor.profileId}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      decision?: "upheld" | "denied";
      decisionPublic?: string;
    };
    if (!body.decision || !body.decisionPublic) {
      return Response.json(
        { error: "decision and decisionPublic are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [appealRow] = await db.select().from(appeals).where(eq(appeals.id, id)).limit(1);
    if (!appealRow) {
      return Response.json({ error: "Appeal not found" }, { status: 404 });
    }
    const [actionRow] = await db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.id, appealRow.moderationActionId))
      .limit(1);
    if (!actionRow) {
      return Response.json({ error: "Moderation action not found" }, { status: 404 });
    }

    const decided = decideAppeal({
      appeal: {
        id: appealRow.id,
        moderationActionId: appealRow.moderationActionId,
        appellantId: appealRow.appellantId,
        status: appealRow.status as AppealStatus,
        statement: appealRow.statement,
        decisionPublic: appealRow.decisionPublic,
        createdAt: appealRow.createdAt,
        resolvedAt: appealRow.resolvedAt,
      },
      action: {
        id: actionRow.id,
        subjectProfileId: actionRow.subjectProfileId,
        issuerId: actionRow.issuerId,
        action: actionRow.action as never,
        ruleCode: actionRow.ruleCode as never,
        publicReason: actionRow.publicReason,
        status: (actionRow.status ?? "active") as ModerationActionStatus,
        scopeJson: actionRow.scopeJson,
        expiresAt: actionRow.expiresAt,
        createdAt: actionRow.createdAt,
      },
      actor,
      decision: body.decision,
      decisionPublic: body.decisionPublic,
    });

    await db
      .update(appeals)
      .set({
        status: decided.appeal.status,
        decisionPublic: decided.appeal.decisionPublic,
        resolvedAt: decided.appeal.resolvedAt,
      })
      .where(eq(appeals.id, id));
    await db
      .update(moderationActions)
      .set({ status: decided.action.status })
      .where(eq(moderationActions.id, actionRow.id));

    return Response.json({
      appeal: {
        id: decided.appeal.id,
        status: decided.appeal.status,
        decisionPublic: decided.appeal.decisionPublic,
        resolvedAt: decided.appeal.resolvedAt,
      },
      action: {
        id: decided.action.id,
        status: decided.action.status,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
