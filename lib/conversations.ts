import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  authUsers,
  conversationMessages,
  conversations,
  listings,
  profiles,
  reputationRatings,
  saleHistory,
} from "../db/schema";
import {
  MESSAGE_HOUR_LIMIT,
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
} from "./conversation-limits";
import { computeSocialCreditScore } from "./social-credit";

export {
  MESSAGE_HOUR_LIMIT,
  MESSAGE_MAX_LENGTH,
  RATING_NOTE_MAX,
  RATING_NOTE_MIN,
} from "./conversation-limits";

type Db = Awaited<ReturnType<typeof getDb>>;

export type ConversationActor = {
  id: string;
  name: string;
};

export function conversationCompleted(row: {
  buyerConfirmedAt?: string | null;
  sellerConfirmedAt?: string | null;
}) {
  return Boolean(row.buyerConfirmedAt && row.sellerConfirmedAt);
}

export async function ensureProfile(
  db: Db,
  userId: string,
  displayName: string,
) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(profiles)
    .values({
      id: userId,
      displayName: displayName.trim() || "Marketplace user",
      updatedAt,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName: displayName.trim() || "Marketplace user", updatedAt },
    });
}

export async function startConversation(
  db: Db,
  actor: ConversationActor,
  listingId: string,
) {
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) {
    return { ok: false as const, status: 404, error: "Listing not found." };
  }
  if (listing.status !== "active") {
    return {
      ok: false as const,
      status: 409,
      error: "This listing is no longer available to message.",
    };
  }
  if (listing.sellerId === actor.id) {
    return {
      ok: false as const,
      status: 400,
      error: "You cannot message your own listing.",
    };
  }

  await ensureProfile(db, actor.id, actor.name);
  await ensureProfile(db, listing.sellerId, listing.sellerName);

  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.listingId, listing.id),
        eq(conversations.buyerId, actor.id),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      ok: true as const,
      created: false,
      conversation: await conversationPayload(db, existing.id, actor.id),
    };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(conversations).values({
    id,
    listingId: listing.id,
    buyerId: actor.id,
    sellerId: listing.sellerId,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ok: true as const,
    created: true,
    conversation: await conversationPayload(db, id, actor.id),
  };
}

export async function listConversations(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)),
    )
    .orderBy(desc(conversations.updatedAt), desc(conversations.id))
    .limit(80);
  const payloads = [];
  for (const row of rows) {
    const payload = await conversationPayload(db, row.id, userId);
    if (payload) payloads.push(payload);
  }
  return payloads;
}

export async function getConversationForUser(
  db: Db,
  conversationId: string,
  userId: string,
) {
  return conversationPayload(db, conversationId, userId);
}

export async function listMessages(
  db: Db,
  conversationId: string,
  userId: string,
) {
  const conversation = await conversationPayload(db, conversationId, userId);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(conversationMessages.createdAt)
    .limit(200);
  return { conversation, messages };
}

export async function sendMessage(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  rawBody: string,
) {
  const conversation = await conversationPayload(db, conversationId, actor.id);
  if (!conversation) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  const body = rawBody.trim();
  if (!body) {
    return { ok: false as const, status: 400, error: "Enter a message." };
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      error: `Messages are limited to ${MESSAGE_MAX_LENGTH} characters.`,
    };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db
    .select({ id: conversationMessages.id })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.senderId, actor.id),
        gte(conversationMessages.createdAt, hourAgo),
      ),
    );
  if (recent.length >= MESSAGE_HOUR_LIMIT) {
    return {
      ok: false as const,
      status: 429,
      error: "Too many messages in the last hour. Try again later.",
    };
  }

  const now = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    senderId: actor.id,
    body,
    createdAt: now,
  };
  await db.insert(conversationMessages).values(message);
  await db
    .update(conversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(conversations.id, conversationId));
  return { ok: true as const, message };
}

export async function confirmSale(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== actor.id && row.sellerId !== actor.id)) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, row.listingId))
    .limit(1);
  if (!listing) {
    return { ok: false as const, status: 404, error: "Listing not found." };
  }
  if (listing.status === "sold" && !conversationCompleted(row)) {
    return {
      ok: false as const,
      status: 409,
      error: "This listing was already sold in another conversation.",
    };
  }

  const now = new Date().toISOString();
  const isBuyer = row.buyerId === actor.id;
  if (isBuyer && row.buyerConfirmedAt) {
    return {
      ok: true as const,
      conversation: await conversationPayload(db, conversationId, actor.id),
    };
  }
  if (!isBuyer && row.sellerConfirmedAt) {
    return {
      ok: true as const,
      conversation: await conversationPayload(db, conversationId, actor.id),
    };
  }

  const nextBuyerConfirmedAt = isBuyer ? now : row.buyerConfirmedAt;
  const nextSellerConfirmedAt = isBuyer ? row.sellerConfirmedAt : now;
  await db
    .update(conversations)
    .set({
      buyerConfirmedAt: nextBuyerConfirmedAt,
      sellerConfirmedAt: nextSellerConfirmedAt,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversationId));

  if (nextBuyerConfirmedAt && nextSellerConfirmedAt && listing.status === "active") {
    const [existingSale] = await db
      .select({ id: saleHistory.id })
      .from(saleHistory)
      .where(eq(saleHistory.listingId, listing.id))
      .limit(1);
    if (!existingSale) {
      await completeSale(
        db,
        {
          ...row,
          buyerConfirmedAt: nextBuyerConfirmedAt,
          sellerConfirmedAt: nextSellerConfirmedAt,
        },
        listing,
        now,
      );
    }
  }

  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function submitRating(
  db: Db,
  actor: ConversationActor,
  conversationId: string,
  score: number,
  rawNote: string,
) {
  const conversation = await conversationPayload(db, conversationId, actor.id);
  if (!conversation) {
    return { ok: false as const, status: 404, error: "Conversation not found." };
  }
  if (!conversation.completed) {
    return {
      ok: false as const,
      status: 409,
      error: "Both people must confirm the sale before rating.",
    };
  }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { ok: false as const, status: 400, error: "Choose a rating from 1 to 5." };
  }
  const note = rawNote.trim();
  if (note.length < RATING_NOTE_MIN || note.length > RATING_NOTE_MAX) {
    return {
      ok: false as const,
      status: 400,
      error: `Explain the rating in ${RATING_NOTE_MIN}–${RATING_NOTE_MAX} characters.`,
    };
  }
  if (conversation.myRating) {
    return {
      ok: false as const,
      status: 409,
      error: "You already rated this sale.",
    };
  }

  const subjectId =
    conversation.myRole === "buyer" ? conversation.sellerId : conversation.buyerId;
  const role = conversation.myRole === "buyer" ? "seller" : "buyer";
  await ensureProfile(
    db,
    subjectId,
    conversation.myRole === "buyer"
      ? conversation.sellerName
      : conversation.buyerName,
  );
  await db.insert(reputationRatings).values({
    id: crypto.randomUUID(),
    listingId: conversation.listingId,
    subjectId,
    raterId: actor.id,
    role,
    score,
    note,
  });
  await recomputeProfileReputation(db, subjectId);
  return {
    ok: true as const,
    conversation: await conversationPayload(db, conversationId, actor.id),
  };
}

export async function listSaleHistory(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(saleHistory)
    .where(or(eq(saleHistory.buyerId, userId), eq(saleHistory.sellerId, userId)))
    .orderBy(desc(saleHistory.soldAt))
    .limit(80);
  const listingIds = rows.map((row) => row.listingId);
  const partyIds = [...new Set(rows.flatMap((row) => [row.buyerId, row.sellerId]))];
  const [ratings, partyProfiles] = await Promise.all([
    listingIds.length
      ? db
          .select()
          .from(reputationRatings)
          .where(inArray(reputationRatings.listingId, listingIds))
      : Promise.resolve([]),
    partyIds.length
      ? db.select().from(profiles).where(inArray(profiles.id, partyIds))
      : Promise.resolve([]),
  ]);
  const nameById = new Map(
    partyProfiles.map((profile) => [profile.id, profile.displayName]),
  );
  return rows.map((row) => {
    const myRole = row.buyerId === userId ? "buyer" : "seller";
    const otherPartyId = myRole === "buyer" ? row.sellerId : row.buyerId;
    const myRating = ratings.find(
      (rating) =>
        rating.listingId === row.listingId &&
        rating.raterId === userId &&
        rating.role === (myRole === "buyer" ? "seller" : "buyer"),
    );
    return {
      id: row.id,
      listingId: row.listingId,
      conversationId: row.conversationId,
      title: row.title,
      priceCents: row.priceCents,
      currency: row.currency,
      soldAt: row.soldAt,
      myRole,
      otherPartyId,
      otherPartyName: nameById.get(otherPartyId) ?? "Marketplace user",
      myRating: myRating
        ? { score: myRating.score, note: myRating.note }
        : null,
    };
  });
}

async function completeSale(
  db: Db,
  row: typeof conversations.$inferSelect,
  listing: typeof listings.$inferSelect,
  soldAt: string,
) {
  await db
    .update(listings)
    .set({ status: "sold", updatedAt: soldAt })
    .where(eq(listings.id, listing.id));

  const [sellerProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, listing.sellerId))
    .limit(1);
  const itemsSold = (sellerProfile?.itemsSold ?? 0) + 1;
  const socialCreditScore = computeSocialCreditScore({
    sellerRating: sellerProfile?.sellerRating,
    sellerRatingCount: sellerProfile?.sellerRatingCount,
    buyerRating: sellerProfile?.buyerRating,
    buyerRatingCount: sellerProfile?.buyerRatingCount,
    itemsSold,
  });
  if (sellerProfile) {
    await db
      .update(profiles)
      .set({ itemsSold, socialCreditScore, updatedAt: soldAt })
      .where(eq(profiles.id, listing.sellerId));
  } else {
    await db.insert(profiles).values({
      id: listing.sellerId,
      displayName: listing.sellerName,
      itemsSold,
      socialCreditScore,
      updatedAt: soldAt,
    });
  }

  await db.insert(saleHistory).values({
    id: crypto.randomUUID(),
    listingId: listing.id,
    conversationId: row.id,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    title: listing.title,
    priceCents: listing.priceCents,
    currency: listing.currency,
    soldAt,
  });
}

async function recomputeProfileReputation(db: Db, subjectId: string) {
  const ratings = await db
    .select()
    .from(reputationRatings)
    .where(eq(reputationRatings.subjectId, subjectId));
  const sellerScores = ratings
    .filter((rating) => rating.role === "seller")
    .map((rating) => rating.score);
  const buyerScores = ratings
    .filter((rating) => rating.role === "buyer")
    .map((rating) => rating.score);
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, subjectId))
    .limit(1);
  const sellerRating = average(sellerScores);
  const buyerRating = average(buyerScores);
  const socialCreditScore = computeSocialCreditScore({
    sellerRating,
    sellerRatingCount: sellerScores.length,
    buyerRating,
    buyerRatingCount: buyerScores.length,
    itemsSold: profile?.itemsSold ?? 0,
  });
  const updatedAt = new Date().toISOString();
  if (profile) {
    await db
      .update(profiles)
      .set({
        sellerRating,
        sellerRatingCount: sellerScores.length,
        buyerRating,
        buyerRatingCount: buyerScores.length,
        socialCreditScore,
        updatedAt,
      })
      .where(eq(profiles.id, subjectId));
    return;
  }
  const [user] = await db
    .select({ name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, subjectId))
    .limit(1);
  await db.insert(profiles).values({
    id: subjectId,
    displayName: user?.name ?? "Marketplace user",
    sellerRating,
    sellerRatingCount: sellerScores.length,
    buyerRating,
    buyerRatingCount: buyerScores.length,
    socialCreditScore,
    updatedAt,
  });
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function conversationPayload(db: Db, conversationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row || (row.buyerId !== userId && row.sellerId !== userId)) return null;

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, row.listingId))
    .limit(1);
  const [buyer] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, row.buyerId))
    .limit(1);
  const [seller] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, row.sellerId))
    .limit(1);
  const [buyerUser] = buyer
    ? []
    : await db
        .select({ name: authUsers.name })
        .from(authUsers)
        .where(eq(authUsers.id, row.buyerId))
        .limit(1);
  const ratings = await db
    .select()
    .from(reputationRatings)
    .where(eq(reputationRatings.listingId, row.listingId));
  const myRole = row.buyerId === userId ? "buyer" : "seller";
  const myRatingRole = myRole === "buyer" ? "seller" : "buyer";
  const myRating = ratings.find(
    (rating) => rating.raterId === userId && rating.role === myRatingRole,
  );
  const otherRating = ratings.find(
    (rating) => rating.raterId !== userId && rating.listingId === row.listingId,
  );
  const [lastMessage] = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(1);
  const [sale] = await db
    .select({ soldAt: saleHistory.soldAt })
    .from(saleHistory)
    .where(eq(saleHistory.listingId, row.listingId))
    .limit(1);

  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: listing?.title ?? "Listing",
    listingStatus: listing?.status ?? "active",
    listingPriceCents: listing?.priceCents ?? 0,
    listingCurrency: listing?.currency ?? "USD",
    soldAt: sale?.soldAt ?? null,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    buyerName: buyer?.displayName ?? buyerUser?.name ?? "Buyer",
    sellerName: seller?.displayName ?? listing?.sellerName ?? "Seller",
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: lastMessage?.body?.slice(0, 140) ?? "",
    buyerConfirmedAt: row.buyerConfirmedAt,
    sellerConfirmedAt: row.sellerConfirmedAt,
    completed: conversationCompleted(row),
    myRole,
    myConfirmed: Boolean(
      myRole === "buyer" ? row.buyerConfirmedAt : row.sellerConfirmedAt,
    ),
    otherConfirmed: Boolean(
      myRole === "buyer" ? row.sellerConfirmedAt : row.buyerConfirmedAt,
    ),
    myRating: myRating ? { score: myRating.score, note: myRating.note } : null,
    otherRating: otherRating
      ? { score: otherRating.score, note: otherRating.note }
      : null,
  };
}
