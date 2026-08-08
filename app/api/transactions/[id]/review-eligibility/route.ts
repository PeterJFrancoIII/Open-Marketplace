import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { reviews, transactions } from "../../../../../db/schema";
import {
  AuthError,
  parseActor,
  rateLimit,
  reviewEligibility,
  type TransactionRecord,
} from "../../../../../lib/trust";

type Params = { params: Promise<{ id: string }> };

function registryError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
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

export async function GET(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `tx:elig:${actor.profileId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const db = await getDb();
    const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(reviews)
      .where(eq(reviews.transactionId, id));

    const record: TransactionRecord = {
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

    const eligibility = reviewEligibility({
      transaction: record,
      actor,
      existingReviewRoles: existing.map(
        (r) => r.role as "buyer_reviews_seller" | "seller_reviews_buyer",
      ),
    });

    return Response.json({
      transactionId: id,
      status: row.status,
      completedAt: row.completedAt,
      reviewDeadlineAt: row.reviewDeadlineAt,
      ...eligibility,
    });
  } catch (error) {
    return registryError(error);
  }
}
