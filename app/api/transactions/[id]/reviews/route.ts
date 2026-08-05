import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  reviewDimensions,
  reviews,
  transactionEvents,
  transactions,
  trustEvents,
  trustProjections,
} from "../../../../../db/schema";
import {
  applyReveal,
  AuthError,
  createSealedReview,
  fingerprintPayload,
  InvalidTrustTransitionError,
  parseActor,
  projectRoleReputation,
  rateLimit,
  resolveReveal,
  type ReviewDimensionInput,
  type ReviewRecord,
  type ReviewRole,
  type TransactionStatus,
} from "../../../../../lib/trust";
import { PROJECTION_VERSION } from "../../../../../lib/trust/projections.ts";

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
      message: unavailable
        ? "The metadata registry is not initialized yet."
        : message,
    },
    { status: unavailable ? 503 : 500 },
  );
}

function rowToReview(
  row: typeof reviews.$inferSelect,
  dimensions: ReviewDimensionInput[] = [],
): ReviewRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    reviewerId: row.reviewerId,
    subjectId: row.subjectId,
    role: row.role as ReviewRole,
    visibility: row.visibility as ReviewRecord["visibility"],
    overallScore: row.overallScore,
    body: row.body,
    dimensions,
    revealedAt: row.revealedAt,
    removedReason: row.removedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function persistRevealAndProjections(
  transactionId: string,
  completedAt: string | null,
  reviewDeadlineAt: string | null,
) {
  const db = await getDb();
  const rows = await db.select().from(reviews).where(eq(reviews.transactionId, transactionId));
  const records = rows.map((r) => rowToReview(r));
  const decision = resolveReveal({
    reviews: records,
    completedAt,
    reviewDeadlineAt,
  });
  if (!decision.revealIds.length) return { revealed: [] as string[], reason: null as string | null };

  const stamped = applyReveal(records, decision.revealIds);
  const now = new Date().toISOString();
  for (const review of stamped.filter((r) => decision.revealIds.includes(r.id))) {
    await db
      .update(reviews)
      .set({
        visibility: "revealed",
        revealedAt: review.revealedAt,
        updatedAt: now,
      })
      .where(eq(reviews.id, review.id));
  }

  const subjects = [...new Set(stamped.map((r) => r.subjectId))];
  for (const subjectId of subjects) {
    const subjectReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.subjectId, subjectId));
    const mapped = subjectReviews.map((r) => rowToReview(r));
    const sellerReviews = mapped.filter((r) => r.role === "buyer_reviews_seller");
    const buyerReviews = mapped.filter((r) => r.role === "seller_reviews_buyer");
    const sellerProj = projectRoleReputation({
      profileId: subjectId,
      memberSince: now,
      role: "seller",
      reviews: sellerReviews,
      completedCount: sellerReviews.filter((r) => r.visibility === "revealed").length,
    });
    const buyerProj = projectRoleReputation({
      profileId: subjectId,
      memberSince: now,
      role: "buyer",
      reviews: buyerReviews,
      completedCount: buyerReviews.filter((r) => r.visibility === "revealed").length,
    });
    const payload = {
      projectionVersion: PROJECTION_VERSION,
      seller: "seller" in sellerProj ? sellerProj.seller : null,
      buyer: "buyer" in buyerProj ? buyerProj.buyer : null,
      experienceLabel:
        "experienceLabel" in sellerProj
          ? sellerProj.experienceLabel
          : "experienceLabel" in buyerProj
            ? buyerProj.experienceLabel
            : "New",
    };
    await db
      .insert(trustProjections)
      .values({
        profileId: subjectId,
        projectionVersion: PROJECTION_VERSION,
        calculatedAt: now,
        lastEventId: decision.revealIds[0] ?? null,
        payloadJson: JSON.stringify(payload),
      })
      .onConflictDoUpdate({
        target: trustProjections.profileId,
        set: {
          projectionVersion: PROJECTION_VERSION,
          calculatedAt: now,
          lastEventId: decision.revealIds[0] ?? null,
          payloadJson: JSON.stringify(payload),
        },
      });
  }

  return { revealed: decision.revealIds, reason: decision.reason };
}

export async function GET(request: Request, context: Params) {
  try {
    const { id: transactionId } = await context.params;
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const db = await getDb();
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);
    if (!tx) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Run reveal job opportunistically on read.
    await persistRevealAndProjections(transactionId, tx.completedAt, tx.reviewDeadlineAt);

    const { toPublicReviewView } = await import("../../../../../lib/trust");
    const rows = await db.select().from(reviews).where(eq(reviews.transactionId, transactionId));
    const views = [];
    for (const row of rows) {
      const dims = await db
        .select()
        .from(reviewDimensions)
        .where(eq(reviewDimensions.reviewId, row.id));
      const record = rowToReview(
        row,
        dims.map((d) => ({
          dimension: d.dimension,
          score: d.score,
          boolValue: d.boolValue == null ? null : d.boolValue === 1,
          tag: d.tag,
        })),
      );
      views.push(
        toPublicReviewView({
          review: record,
          viewer: actor,
          reviewDeadlineAt: tx.reviewDeadlineAt,
        }),
      );
    }

    return Response.json({
      transactionId,
      reviewDeadlineAt: tx.reviewDeadlineAt,
      reviews: views,
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request, context: Params) {
  try {
    const { id: transactionId } = await context.params;
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `review:create:${actor.profileId}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const overallScore = Number(payload.overallScore);
    const body = typeof payload.body === "string" ? payload.body : "";
    const dimensions = Array.isArray(payload.dimensions)
      ? (payload.dimensions as ReviewDimensionInput[])
      : [];

    const db = await getDb();
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);
    if (!tx) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(reviews)
      .where(eq(reviews.transactionId, transactionId));

    const sealed = createSealedReview({
      id: crypto.randomUUID(),
      transaction: {
        id: tx.id,
        buyerId: tx.buyerId,
        sellerId: tx.sellerId,
        status: tx.status as TransactionStatus,
        completedAt: tx.completedAt,
        reviewDeadlineAt: tx.reviewDeadlineAt,
      },
      actor,
      overallScore,
      body,
      dimensions,
      existingRoles: existing.map((r) => r.role as ReviewRole),
    });

    await db.insert(reviews).values({
      id: sealed.id,
      transactionId: sealed.transactionId,
      reviewerId: sealed.reviewerId,
      subjectId: sealed.subjectId,
      role: sealed.role,
      visibility: sealed.visibility,
      overallScore: sealed.overallScore,
      body: sealed.body,
      revealedAt: null,
      removedReason: null,
      createdAt: sealed.createdAt,
      updatedAt: sealed.updatedAt,
    });

    for (const dim of sealed.dimensions) {
      await db.insert(reviewDimensions).values({
        id: crypto.randomUUID(),
        reviewId: sealed.id,
        dimension: dim.dimension,
        score: dim.score ?? null,
        boolValue: dim.boolValue == null ? null : dim.boolValue ? 1 : 0,
        tag: dim.tag ?? null,
      });
    }

    const payloadHash = fingerprintPayload({
      type: "review.sealed",
      reviewId: sealed.id,
      score: sealed.overallScore,
    });
    await db.insert(transactionEvents).values({
      id: crypto.randomUUID(),
      transactionId,
      actorProfileId: actor.profileId,
      eventType: "review.sealed",
      reason: "",
      payloadHash,
      priorEventHash: null,
      occurredAt: sealed.createdAt,
    });
    await db.insert(trustEvents).values({
      id: crypto.randomUUID(),
      subjectProfileId: sealed.subjectId,
      actorProfileId: actor.profileId,
      eventType: "review.sealed",
      occurredAt: sealed.createdAt,
      payloadHash,
      priorEventHash: null,
      registryId: process.env.NEXT_PUBLIC_REGISTRY_ID ?? "open-marketplace-local",
      schemaVersion: 1,
      signature: `unsigned:${payloadHash.slice(0, 16)}`,
    });

    const reveal = await persistRevealAndProjections(
      transactionId,
      tx.completedAt,
      tx.reviewDeadlineAt,
    );

    return Response.json(
      {
        review: {
          id: sealed.id,
          visibility: sealed.visibility,
          role: sealed.role,
          overallScore: sealed.overallScore,
          body: sealed.body,
          dimensions: sealed.dimensions,
          sealedExists: true,
          reviewDeadlineAt: tx.reviewDeadlineAt,
          // Double-blind: never disclose whether the other party has reviewed.
          counterpartyReviewRevealed: false,
        },
        reveal,
      },
      { status: 201 },
    );
  } catch (error) {
    return registryError(error);
  }
}
