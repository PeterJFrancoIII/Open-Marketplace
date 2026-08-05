import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reviewDimensions, reviews } from "../../../../db/schema";
import {
  AuthError,
  editSealedReview,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  tombstoneReview,
  toPublicReviewView,
  type ReviewDimensionInput,
  type ReviewRecord,
  type ReviewRole,
} from "../../../../lib/trust";
import { appendSignedTrustEvent } from "../../../../lib/trust/persist-event.ts";

type Params = { params: Promise<{ id: string }> };

function registryError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof InvalidTrustTransitionError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable = message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    {
      error: unavailable ? "registry_unavailable" : "registry_error",
      message,
    },
    { status: unavailable ? 503 : 500 },
  );
}

async function loadReview(id: string): Promise<ReviewRecord | null> {
  const db = await getDb();
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!row) return null;
  const dims = await db
    .select()
    .from(reviewDimensions)
    .where(eq(reviewDimensions.reviewId, id));
  return {
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
}

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const review = await loadReview(id);
    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }
    return Response.json({
      review: toPublicReviewView({
        review,
        viewer: actor,
        reviewDeadlineAt: null,
      }),
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `review:edit:${actor.profileId}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const existing = await loadReview(id);
    if (!existing) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const edited = editSealedReview({
      review: existing,
      actor,
      overallScore: payload.overallScore === undefined ? undefined : Number(payload.overallScore),
      body: typeof payload.body === "string" ? payload.body : undefined,
      dimensions: Array.isArray(payload.dimensions)
        ? (payload.dimensions as ReviewDimensionInput[])
        : undefined,
    });

    const db = await getDb();
    await db
      .update(reviews)
      .set({
        overallScore: edited.overallScore,
        body: edited.body,
        updatedAt: edited.updatedAt,
      })
      .where(eq(reviews.id, id));

    if (payload.dimensions) {
      // Replace dimensions for sealed edit.
      const old = await db
        .select()
        .from(reviewDimensions)
        .where(eq(reviewDimensions.reviewId, id));
      for (const row of old) {
        await db.delete(reviewDimensions).where(eq(reviewDimensions.id, row.id));
      }
      for (const dim of edited.dimensions) {
        await db.insert(reviewDimensions).values({
          id: crypto.randomUUID(),
          reviewId: id,
          dimension: dim.dimension,
          score: dim.score ?? null,
          boolValue: dim.boolValue == null ? null : dim.boolValue ? 1 : 0,
          tag: dim.tag ?? null,
        });
      }
    }

    await appendSignedTrustEvent({
      subjectProfileId: existing.subjectId,
      actorProfileId: actor.profileId,
      eventType: "review.edited",
      occurredAt: edited.updatedAt,
      payload: {
        type: "review.edited",
        reviewId: id,
        score: edited.overallScore,
      },
    });

    return Response.json({
      review: toPublicReviewView({
        review: edited,
        viewer: actor,
        reviewDeadlineAt: null,
      }),
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const existing = await loadReview(id);
    if (!existing) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reasonCode =
      typeof payload.reasonCode === "string"
        ? payload.reasonCode
        : "policy_violation";
    const tombstoned = tombstoneReview({
      review: existing,
      actor,
      reasonCode,
    });
    const db = await getDb();
    await db
      .update(reviews)
      .set({
        visibility: "removed",
        body: "",
        removedReason: tombstoned.removedReason,
        updatedAt: tombstoned.updatedAt,
      })
      .where(eq(reviews.id, id));

    await appendSignedTrustEvent({
      subjectProfileId: existing.subjectId,
      actorProfileId: actor.profileId,
      eventType: "review.tombstone",
      occurredAt: tombstoned.updatedAt,
      payload: { type: "review.tombstone", reviewId: id, reasonCode },
    });

    return Response.json({
      review: toPublicReviewView({
        review: tombstoned,
        viewer: actor,
        reviewDeadlineAt: null,
      }),
    });
  } catch (error) {
    return registryError(error);
  }
}
