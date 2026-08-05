import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  profiles,
  reviewDimensions,
  reviews,
  transactionEvents,
  transactions,
  trustEvents,
  trustProjections,
} from "../../../../../db/schema";
import {
  applyReveal,
  assertTransactionParticipant,
  AuthError,
  buildSignedTrustEvent,
  createSealedReview,
  fingerprintPayload,
  InvalidTrustTransitionError,
  parseActor,
  projectRoleReputation,
  rateLimit,
  resolveReveal,
  toPublicReviewView,
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

async function completedCountsForProfiles(profileIds: string[]) {
  const db = await getDb();
  const counts = new Map<string, { sold: number; bought: number; memberSince: string }>();
  if (!profileIds.length) return counts;

  const soldFromTx = new Map<string, number>();
  const boughtFromTx = new Map<string, number>();
  const profileRows = await db
    .select()
    .from(profiles)
    .where(inArray(profiles.id, profileIds));

  const completedTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        or(
          inArray(transactions.buyerId, profileIds),
          inArray(transactions.sellerId, profileIds),
        ),
        or(
          eq(transactions.status, "completed"),
          eq(transactions.status, "review_window"),
        ),
      ),
    );

  for (const tx of completedTx) {
    soldFromTx.set(tx.sellerId, (soldFromTx.get(tx.sellerId) ?? 0) + 1);
    boughtFromTx.set(tx.buyerId, (boughtFromTx.get(tx.buyerId) ?? 0) + 1);
  }

  for (const profileId of profileIds) {
    const profile = profileRows.find((p) => p.id === profileId);
    const soldTx = soldFromTx.get(profileId) ?? 0;
    counts.set(profileId, {
      // Prefer durable profile counter; never use review-count as sales volume.
      sold: Math.max(profile?.itemsSold ?? 0, soldTx),
      bought: boughtFromTx.get(profileId) ?? 0,
      memberSince: profile?.createdAt ?? new Date().toISOString(),
    });
  }

  return counts;
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
  const completed = await completedCountsForProfiles(subjects);

  for (const subjectId of subjects) {
    const subjectReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.subjectId, subjectId));
    const mapped = subjectReviews.map((r) => rowToReview(r));
    const sellerReviews = mapped.filter((r) => r.role === "buyer_reviews_seller");
    const buyerReviews = mapped.filter((r) => r.role === "seller_reviews_buyer");
    const stats = completed.get(subjectId) ?? {
      sold: 0,
      bought: 0,
      memberSince: now,
    };
    const sellerProj = projectRoleReputation({
      profileId: subjectId,
      memberSince: stats.memberSince,
      role: "seller",
      reviews: sellerReviews,
      completedCount: stats.sold,
    });
    const buyerProj = projectRoleReputation({
      profileId: subjectId,
      memberSince: stats.memberSince,
      role: "buyer",
      reviews: buyerReviews,
      completedCount: stats.bought,
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
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const db = await getDb();
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);
    if (!tx) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    assertTransactionParticipant(actor, tx);

    // Run reveal job opportunistically on read.
    await persistRevealAndProjections(transactionId, tx.completedAt, tx.reviewDeadlineAt);

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
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
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

    assertTransactionParticipant(actor, tx);

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
    const [prior] = await db
      .select({ payloadHash: trustEvents.payloadHash })
      .from(trustEvents)
      .where(eq(trustEvents.subjectProfileId, sealed.subjectId))
      .orderBy(desc(trustEvents.occurredAt))
      .limit(1);
    const envelope = await buildSignedTrustEvent({
      eventId: crypto.randomUUID(),
      subjectProfileId: sealed.subjectId,
      actorProfileId: actor.profileId,
      eventType: "review.sealed",
      occurredAt: sealed.createdAt,
      payload: {
        type: "review.sealed",
        reviewId: sealed.id,
        score: sealed.overallScore,
      },
      priorEventHash: prior?.payloadHash ?? null,
    });
    await db.insert(trustEvents).values({
      id: envelope.eventId,
      subjectProfileId: envelope.subjectProfileId,
      actorProfileId: envelope.actorProfileId ?? null,
      eventType: envelope.eventType,
      occurredAt: envelope.occurredAt,
      payloadHash: envelope.payloadHash,
      priorEventHash: envelope.priorEventHash ?? null,
      registryId: envelope.registryId,
      schemaVersion: envelope.schemaVersion,
      signature: envelope.signature,
    });

    const reveal = await persistRevealAndProjections(
      transactionId,
      tx.completedAt,
      tx.reviewDeadlineAt,
    );

    // Reload so response reflects reveal when both sides submitted / deadline hit.
    const [fresh] = await db.select().from(reviews).where(eq(reviews.id, sealed.id)).limit(1);
    const dims = await db
      .select()
      .from(reviewDimensions)
      .where(eq(reviewDimensions.reviewId, sealed.id));
    const record = rowToReview(
      fresh ?? {
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
      },
      dims.map((d) => ({
        dimension: d.dimension,
        score: d.score,
        boolValue: d.boolValue == null ? null : d.boolValue === 1,
        tag: d.tag,
      })),
    );
    const publicView = toPublicReviewView({
      review: record,
      viewer: actor,
      reviewDeadlineAt: tx.reviewDeadlineAt,
    });

    return Response.json(
      {
        review: publicView,
        reveal,
      },
      { status: 201 },
    );
  } catch (error) {
    return registryError(error);
  }
}
