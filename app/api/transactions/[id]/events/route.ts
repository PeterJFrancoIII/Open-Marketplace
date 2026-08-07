import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { transactionEvents, transactions } from "../../../../../db/schema";
import {
  applyTransactionEvent,
  assertTransactionParticipant,
  AuthError,
  fingerprintPayload,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
  type TransactionEventInput,
  type TransactionRecord,
} from "../../../../../lib/trust";
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

function rowToRecord(row: typeof transactions.$inferSelect): TransactionRecord {
  return {
    id: row.id,
    listingId: row.listingId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    status: row.status as TransactionRecord["status"],
    offerCents: row.offerCents,
    currency: row.currency,
    meetupNonce: row.meetupNonce,
    meetupNonceExpiresAt: row.meetupNonceExpiresAt,
    buyerConfirmedAt: row.buyerConfirmedAt,
    sellerConfirmedAt: row.sellerConfirmedAt,
    completedAt: row.completedAt,
    reviewDeadlineAt: row.reviewDeadlineAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function POST(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `tx:event:${actor.profileId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const type = String(payload.type ?? "") as TransactionEventInput["type"];
    const event: TransactionEventInput = {
      type,
      meetupNonce: typeof payload.meetupNonce === "string" ? payload.meetupNonce : undefined,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    };

    const db = await getDb();
    const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    assertTransactionParticipant(actor, row, true);
    const priorEvents = await db
      .select()
      .from(transactionEvents)
      .where(eq(transactionEvents.transactionId, id))
      .orderBy(desc(transactionEvents.occurredAt))
      .limit(1);

    const result = applyTransactionEvent({
      transaction: rowToRecord(row),
      actor,
      event,
    });

    const [updated] = await db
      .update(transactions)
      .set({
        status: result.transaction.status,
        meetupNonce: result.transaction.meetupNonce,
        meetupNonceExpiresAt: result.transaction.meetupNonceExpiresAt,
        buyerConfirmedAt: result.transaction.buyerConfirmedAt,
        sellerConfirmedAt: result.transaction.sellerConfirmedAt,
        completedAt: result.transaction.completedAt,
        reviewDeadlineAt: result.transaction.reviewDeadlineAt,
        updatedAt: result.transaction.updatedAt,
      })
      .where(eq(transactions.id, id))
      .returning();

    const payloadHash = fingerprintPayload({ type: event.type, meetup: Boolean(event.meetupNonce) });
    await db.insert(transactionEvents).values({
      id: crypto.randomUUID(),
      transactionId: id,
      actorProfileId: actor.profileId,
      eventType: result.eventType,
      reason: event.reason ?? "",
      payloadHash,
      priorEventHash: priorEvents[0]?.payloadHash ?? null,
      occurredAt: result.transaction.updatedAt,
    });

    // Completions without reviews still advance sales counts via projection rebuild.
    const enteredReviewable =
      (result.transaction.status === "completed" ||
        result.transaction.status === "review_window") &&
      row.status !== result.transaction.status;
    if (enteredReviewable) {
      await rebuildAndPersistProjections(
        [result.transaction.buyerId, result.transaction.sellerId],
        {
          actorProfileId: actor.profileId,
          occurredAt: result.transaction.updatedAt,
        },
      );
    }

    // Never echo the raw nonce to strangers; parties already know it from issue response.
    return Response.json({
      transaction: updated,
      eventType: result.eventType,
    });
  } catch (error) {
    return registryError(error);
  }
}
