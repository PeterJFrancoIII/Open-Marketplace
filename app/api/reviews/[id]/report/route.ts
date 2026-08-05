import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { profiles, reviewReports, reviews } from "../../../../../db/schema";
import {
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  reportReview,
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
    const { id: reviewId } = await context.params;
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `reviews:report:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as { reasonCode?: string; details?: string };
    if (!body.reasonCode) {
      return Response.json({ error: "reasonCode is required" }, { status: 400 });
    }

    const db = await getDb();
    const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(reviewReports)
      .where(
        and(
          eq(reviewReports.reviewId, reviewId),
          eq(reviewReports.reporterId, actor.profileId),
        ),
      )
      .limit(1);

    const record = reportReview({
      id: `rrep_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      actor,
      review: {
        id: review.id,
        reviewerId: review.reviewerId,
        subjectId: review.subjectId,
        visibility: review.visibility,
      },
      reasonCode: body.reasonCode,
      details: body.details,
      alreadyReportedByActor: Boolean(existing),
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

    await db.insert(reviewReports).values({
      id: record.id,
      reviewId: record.reviewId,
      reporterId: record.reporterId,
      reasonCode: record.reasonCode,
      status: record.status,
      details: record.details,
      createdAt: record.createdAt,
      resolvedAt: record.resolvedAt,
    });

    return Response.json(
      {
        report: {
          id: record.id,
          reviewId: record.reviewId,
          status: record.status,
          reasonCode: record.reasonCode,
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
