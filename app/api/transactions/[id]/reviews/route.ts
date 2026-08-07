import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  reviewDimensions,
  reviews,
  transactionEvents,
  transactions,
} from "../../../../../db/schema";
import {
  applyReveal,
  assertTransactionParticipant,
  AuthError,
  createSealedReview,
  fingerprintPayload,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  resolveReveal,
  toPublicReviewView,
  type ReviewDimensionInput,
  type ReviewRecord,
  type ReviewRole,
  type TransactionStatus,
} from "../../../../../lib/trust";
import { commitWithSignedTrustEvent } from "../../../../../lib/trust/persist-event.ts";
import { rebuildAndPersistProjections } from "../../../../../lib/trust/rebuild-projections.ts";

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
  if (!decision.revealIds.length) {
    return { revealed: [] as string[], reason: null as string | null };
  }

  const stamped = applyReveal(records, decision.revealIds);
  const now = new Date().toISOString();
  for (const review of stamped.filter((r) => decision.revealIds.includes(r.id))) {
    // Sign first; batch review reveal + trust event so key failures leave no half-state.
    await commitWithSignedTrustEvent({
      subjectProfileId: review.subjectId,
      actorProfileId: review.reviewerId,
      eventType: "review.revealed",
      occurredAt: now,
      payload: {
        type: "review.revealed",
        reviewId: review.id,
        transactionId,
        score: review.overallScore,
        reason: decision.reason,
      },
      run: async ({ db: batchDb, eventInsert }) => {
        await batchDb.batch([
          batchDb
            .update(reviews)
            .set({
              visibility: "revealed",
              revealedAt: review.revealedAt,
              updatedAt: now,
            })
            .where(eq(reviews.id, review.id)),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventInsert as any,
        ]);
      },
    });
  }

  const subjects = [...new Set(stamped.map((r) => r.subjectId))];
  await rebuildAndPersistProjections(subjects, { occurredAt: now });

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

    const payloadHash = fingerprintPayload({
      type: "review.sealed",
      reviewId: sealed.id,
      score: sealed.overallScore,
    });

    await commitWithSignedTrustEvent({
      subjectProfileId: sealed.subjectId,
      actorProfileId: actor.profileId,
      eventType: "review.sealed",
      occurredAt: sealed.createdAt,
      payload: {
        type: "review.sealed",
        reviewId: sealed.id,
        score: sealed.overallScore,
      },
      run: async ({ db: batchDb, eventInsert }) => {
        await batchDb.batch([
          batchDb.insert(reviews).values({
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
          }),
          ...sealed.dimensions.map((dim) =>
            batchDb.insert(reviewDimensions).values({
              id: crypto.randomUUID(),
              reviewId: sealed.id,
              dimension: dim.dimension,
              score: dim.score ?? null,
              boolValue: dim.boolValue == null ? null : dim.boolValue ? 1 : 0,
              tag: dim.tag ?? null,
            }),
          ),
          batchDb.insert(transactionEvents).values({
            id: crypto.randomUUID(),
            transactionId,
            actorProfileId: actor.profileId,
            eventType: "review.sealed",
            reason: "",
            payloadHash,
            priorEventHash: null,
            occurredAt: sealed.createdAt,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventInsert as any,
        ]);
      },
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
