import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { disputes } from "../../../../db/schema";
import {
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  transitionDispute,
  type DisputeStatus,
} from "../../../../lib/trust";

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
      key: `disputes:update:${actor.profileId}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      to?: DisputeStatus;
      resolutionCode?: string;
      publicOutcome?: string;
    };
    if (!body.to) {
      return Response.json({ error: "to status is required" }, { status: 400 });
    }

    const db = await getDb();
    const [row] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    if (!row) {
      return Response.json({ error: "Dispute not found" }, { status: 404 });
    }

    const next = transitionDispute({
      dispute: {
        id: row.id,
        transactionId: row.transactionId,
        openedBy: row.openedBy,
        status: row.status as DisputeStatus,
        reasonCode: row.reasonCode as never,
        summary: row.summary,
        resolutionCode: row.resolutionCode,
        publicOutcome: row.publicOutcome,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
      },
      actor,
      to: body.to,
      resolutionCode: body.resolutionCode,
      publicOutcome: body.publicOutcome,
    });

    await db
      .update(disputes)
      .set({
        status: next.status,
        resolutionCode: next.resolutionCode,
        publicOutcome: next.publicOutcome,
        resolvedAt: next.resolvedAt,
      })
      .where(eq(disputes.id, id));

    return Response.json({
      dispute: {
        id: next.id,
        status: next.status,
        reasonCode: next.reasonCode,
        publicOutcome: next.publicOutcome,
        resolvedAt: next.resolvedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
