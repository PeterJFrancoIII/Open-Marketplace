import { desc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, profiles, transactionEvents, transactions } from "../../../db/schema";
import {
  AuthError,
  createProposedTransaction,
  fingerprintPayload,
  parseActor,
  rateLimit,
  recallIdempotent,
  rememberIdempotent,
} from "../../../lib/trust";

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

function moderatorToken(): string | null {
  return process.env.MODERATOR_TOKEN ?? null;
}

async function ensureProfile(id: string, displayName: string) {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db
    .insert(profiles)
    .values({ id, displayName, updatedAt })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { updatedAt },
    });
}

export async function GET(request: Request) {
  try {
    const actor = await parseActor(request, moderatorToken());
    const limited = rateLimit({
      key: `tx:list:${actor.profileId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
      );
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(transactions)
      .where(
        or(
          eq(transactions.buyerId, actor.profileId),
          eq(transactions.sellerId, actor.profileId),
        ),
      )
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    return Response.json({ transactions: rows });
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await parseActor(request, moderatorToken());
    const limited = rateLimit({
      key: `tx:create:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    const fingerprint = fingerprintPayload(payload);
    if (idempotencyKey) {
      const prior = recallIdempotent({ key: `tx:${idempotencyKey}`, fingerprint });
      if (prior.hit) {
        if (prior.conflict) {
          return Response.json(
            { error: "Idempotency-Key reused with a different payload" },
            { status: 409 },
          );
        }
        return Response.json(prior.body, { status: prior.status });
      }
    }

    const listingId = typeof payload.listingId === "string" ? payload.listingId.trim() : "";
    const offerCents =
      payload.offerCents === undefined || payload.offerCents === null
        ? null
        : Number(payload.offerCents);
    if (!listingId) {
      return Response.json({ error: "listingId is required" }, { status: 400 });
    }
    if (offerCents !== null && (!Number.isSafeInteger(offerCents) || offerCents < 0)) {
      return Response.json({ error: "Invalid offerCents" }, { status: 400 });
    }

    const db = await getDb();
    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) {
      return Response.json({ error: "Listing not found" }, { status: 404 });
    }
    if (listing.sellerId === actor.profileId) {
      return Response.json({ error: "Sellers cannot buy their own listing" }, { status: 422 });
    }

    await ensureProfile(actor.profileId, "Buyer");
    await ensureProfile(listing.sellerId, listing.sellerName);

    const proposed = createProposedTransaction({
      id: crypto.randomUUID(),
      listingId: listing.id,
      buyerId: actor.profileId,
      sellerId: listing.sellerId,
      offerCents,
    });

    const [row] = await db
      .insert(transactions)
      .values({
        id: proposed.id,
        listingId: proposed.listingId,
        buyerId: proposed.buyerId,
        sellerId: proposed.sellerId,
        status: proposed.status,
        offerCents: proposed.offerCents,
        currency: proposed.currency,
        meetupNonce: null,
        meetupNonceExpiresAt: null,
        buyerConfirmedAt: null,
        sellerConfirmedAt: null,
        completedAt: null,
        reviewDeadlineAt: null,
        createdAt: proposed.createdAt,
        updatedAt: proposed.updatedAt,
      })
      .returning();

    const payloadHash = fingerprintPayload({ type: "proposed", listingId });
    await db.insert(transactionEvents).values({
      id: crypto.randomUUID(),
      transactionId: row.id,
      actorProfileId: actor.profileId,
      eventType: "offer.proposed",
      reason: "",
      payloadHash,
      priorEventHash: null,
      occurredAt: proposed.createdAt,
    });

    const body = { transaction: row };
    if (idempotencyKey) {
      rememberIdempotent({
        key: `tx:${idempotencyKey}`,
        fingerprint,
        body,
        status: 201,
      });
    }
    return Response.json(body, { status: 201 });
  } catch (error) {
    return registryError(error);
  }
}
