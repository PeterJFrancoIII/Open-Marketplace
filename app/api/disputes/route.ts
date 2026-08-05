import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { disputes, profiles, transactions } from "../../../db/schema";
import {
  AuthError,
  applyTransactionEvent,
  InvalidTrustTransitionError,
  openDispute,
  parseActor,
  rateLimit,
  roleOnTransaction,
  type DisputeStatus,
  type PublicReasonCategory,
  type TransactionRecord,
  type TransactionStatus,
} from "../../../lib/trust";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof InvalidTrustTransitionError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable = message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    { error: unavailable ? "registry_unavailable" : "registry_error", message },
    { status: unavailable ? 503 : 500 },
  );
}

async function ensureProfile(id: string) {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db
    .insert(profiles)
    .values({ id, displayName: `User ${id.slice(0, 8)}`, updatedAt })
    .onConflictDoUpdate({ target: profiles.id, set: { updatedAt } });
}

export async function GET(request: Request) {
  try {
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `disputes:list:${actor.profileId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const db = await getDb();
    let list: Array<{
      id: string;
      transactionId: string;
      status: string;
      reasonCode: string;
      publicOutcome: string | null;
      createdAt: string;
      resolvedAt: string | null;
      openedBy?: string;
    }>;

    if (actor.isModerator) {
      const rows = await db.select().from(disputes).limit(100);
      list = rows.map((d) => ({
        id: d.id,
        transactionId: d.transactionId,
        status: d.status,
        reasonCode: d.reasonCode,
        publicOutcome: d.publicOutcome,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
        openedBy: d.openedBy,
      }));
    } else {
      const rows = await db
        .select({ dispute: disputes })
        .from(disputes)
        .innerJoin(transactions, eq(disputes.transactionId, transactions.id))
        .where(
          or(
            eq(disputes.openedBy, actor.profileId),
            eq(transactions.buyerId, actor.profileId),
            eq(transactions.sellerId, actor.profileId),
          ),
        )
        .limit(100);
      list = rows.map(({ dispute: d }) => ({
        id: d.id,
        transactionId: d.transactionId,
        status: d.status,
        reasonCode: d.reasonCode,
        publicOutcome: d.publicOutcome,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
        openedBy: d.openedBy === actor.profileId ? d.openedBy : undefined,
      }));
    }

    return Response.json({ disputes: list });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `disputes:open:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      transactionId?: string;
      reasonCode?: string;
      summary?: string;
    };
    if (!body.transactionId || !body.reasonCode) {
      return Response.json(
        { error: "transactionId and reasonCode are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, body.transactionId))
      .limit(1);
    if (!tx) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(disputes)
      .where(
        and(
          eq(disputes.transactionId, tx.id),
          or(eq(disputes.status, "open"), eq(disputes.status, "under_review")),
        ),
      )
      .limit(1);

    const record = openDispute({
      id: `dispute_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      transaction: {
        id: tx.id,
        buyerId: tx.buyerId,
        sellerId: tx.sellerId,
        status: tx.status as TransactionStatus,
      },
      actor,
      reasonCode: body.reasonCode,
      summary: body.summary,
      existingOpenForTx: Boolean(existing),
    });

    await ensureProfile(actor.profileId);

    // Mark transaction disputed when a party opens (moderators do not force this).
    const txRecord: TransactionRecord = {
      id: tx.id,
      listingId: tx.listingId,
      buyerId: tx.buyerId,
      sellerId: tx.sellerId,
      status: tx.status as TransactionStatus,
      offerCents: tx.offerCents,
      currency: tx.currency,
      meetupNonce: tx.meetupNonce,
      meetupNonceExpiresAt: tx.meetupNonceExpiresAt,
      buyerConfirmedAt: tx.buyerConfirmedAt,
      sellerConfirmedAt: tx.sellerConfirmedAt,
      completedAt: tx.completedAt,
      reviewDeadlineAt: tx.reviewDeadlineAt,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
    const role = roleOnTransaction(actor, txRecord);
    if (
      (role === "buyer" || role === "seller") &&
      (tx.status === "accepted" || tx.status === "fulfilled")
    ) {
      const next = applyTransactionEvent({
        transaction: txRecord,
        actor,
        event: { type: "dispute" },
      });
      await db
        .update(transactions)
        .set({ status: next.transaction.status, updatedAt: next.transaction.updatedAt })
        .where(eq(transactions.id, tx.id));
    }

    await db.insert(disputes).values({
      id: record.id,
      transactionId: record.transactionId,
      openedBy: record.openedBy,
      status: record.status,
      reasonCode: record.reasonCode,
      summary: record.summary,
      resolutionCode: record.resolutionCode,
      publicOutcome: record.publicOutcome,
      createdAt: record.createdAt,
      resolvedAt: record.resolvedAt,
    });

    return Response.json(
      {
        dispute: {
          id: record.id,
          transactionId: record.transactionId,
          status: record.status as DisputeStatus,
          reasonCode: record.reasonCode as PublicReasonCategory,
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
