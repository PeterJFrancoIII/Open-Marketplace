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
import { commitAtomicTrustBatch } from "../../../../../lib/trust/persist-event.ts";
import { experienceLabel } from "../../../../../lib/trust/projections.ts";
import {
  buildProjectionPayloadForProfile,
  projectionUpsertQuery,
} from "../../../../../lib/trust/rebuild-projections.ts";

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

    const payloadHash = fingerprintPayload({ type: event.type, meetup: Boolean(event.meetupNonce) });
    const enteredReviewable =
      (result.transaction.status === "completed" ||
        result.transaction.status === "review_window") &&
      row.status !== result.transaction.status;

    if (!enteredReviewable) {
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
      return Response.json({
        transaction: updated,
        eventType: result.eventType,
      });
    }

    // Completions: transaction row + ledger event + tip projections in one batch.
    const subjects = [result.transaction.buyerId, result.transaction.sellerId];
    const projectionPayloads = new Map<
      string,
      { payload: unknown; payloadJson: string }
    >();
    for (const profileId of subjects) {
      projectionPayloads.set(
        profileId,
        await buildProjectionPayloadForProfile(profileId),
      );
    }
    // Sales counts will include this tx only after the update lands; bump seller/buyer
    // projections by rewriting completedSales from post-state via a second pass after
    // we apply the status in-memory for payload construction.
    for (const profileId of subjects) {
      const built = projectionPayloads.get(profileId)!;
      const parsed = JSON.parse(built.payloadJson) as {
        projectionVersion: string;
        seller: { completedSales?: number } | null;
        buyer: { completedPurchases?: number } | null;
        experienceLabel: string;
      };
      if (profileId === result.transaction.sellerId && parsed.seller) {
        parsed.seller.completedSales = Number(parsed.seller.completedSales ?? 0) + 1;
        parsed.experienceLabel = experienceLabel(
          Number(parsed.seller.completedSales ?? 0),
        );
      }
      if (profileId === result.transaction.buyerId && parsed.buyer) {
        parsed.buyer.completedPurchases =
          Number(parsed.buyer.completedPurchases ?? 0) + 1;
      }
      projectionPayloads.set(profileId, {
        payload: parsed,
        payloadJson: JSON.stringify(parsed),
      });
    }

    let updated = result.transaction;
    await commitAtomicTrustBatch({
      subjectEvents: subjects.map((profileId) => ({
        subjectProfileId: profileId,
        events: [
          {
            actorProfileId: actor.profileId,
            eventType: "projection.rebuilt",
            occurredAt: result.transaction.updatedAt,
            payload: projectionPayloads.get(profileId)!.payload,
          },
        ],
      })),
      run: async ({ db: batchDb, envelopesBySubject, eventInserts }) => {
        await batchDb.batch([
          batchDb
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
            .where(eq(transactions.id, id)),
          batchDb.insert(transactionEvents).values({
            id: crypto.randomUUID(),
            transactionId: id,
            actorProfileId: actor.profileId,
            eventType: result.eventType,
            reason: event.reason ?? "",
            payloadHash,
            priorEventHash: priorEvents[0]?.payloadHash ?? null,
            occurredAt: result.transaction.updatedAt,
          }),
          ...eventInserts,
          ...subjects.map((profileId) => {
            const tip = envelopesBySubject.get(profileId)!.at(-1)!;
            return projectionUpsertQuery(batchDb, {
              profileId,
              lastEventId: tip.eventId,
              payloadJson: projectionPayloads.get(profileId)!.payloadJson,
              calculatedAt: result.transaction.updatedAt,
            });
          }),
          // D1 batch accepts heterogeneous query builders.
        ] as never);
        const [fresh] = await batchDb
          .select()
          .from(transactions)
          .where(eq(transactions.id, id))
          .limit(1);
        if (fresh) updated = rowToRecord(fresh);
      },
    });

    return Response.json({
      transaction: updated,
      eventType: result.eventType,
    });
  } catch (error) {
    return registryError(error);
  }
}
