import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { reviewResponses } from "../../../../../db/schema";
import {
  addPublicResponse,
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  type ReviewRecord,
  type ReviewRole,
} from "../../../../../lib/trust";
import { reviews, reviewDimensions } from "../../../../../db/schema";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `review:response:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const db = await getDb();
    const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!row) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }
    const dims = await db
      .select()
      .from(reviewDimensions)
      .where(eq(reviewDimensions.reviewId, id));
    const review: ReviewRecord = {
      id: row.id,
      transactionId: row.transactionId,
      reviewerId: row.reviewerId,
      subjectId: row.subjectId,
      role: row.role as ReviewRole,
      visibility: row.visibility as ReviewRecord["visibility"],
      overallScore: row.overallScore,
      body: row.body,
      dimensions: dims.map((d) => ({
        dimension: d.dimension,
        score: d.score,
        boolValue: d.boolValue == null ? null : d.boolValue === 1,
        tag: d.tag,
      })),
      revealedAt: row.revealedAt,
      removedReason: row.removedReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    const prior = await db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, id));
    const payload = (await request.json()) as Record<string, unknown>;
    const response = addPublicResponse({
      review,
      actor,
      body: typeof payload.body === "string" ? payload.body : "",
      existingResponse: prior.length > 0,
    });
    await db.insert(reviewResponses).values({
      id: crypto.randomUUID(),
      reviewId: response.reviewId,
      authorId: response.authorId,
      kind: response.kind,
      body: response.body,
    });
    return Response.json({ response }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof InvalidTrustTransitionError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
