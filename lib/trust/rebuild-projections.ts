import { and, eq, inArray, or } from "drizzle-orm";
import { getDb, type AppDb } from "../../db/index.ts";
import {
  profiles,
  reviews,
  transactions,
  trustProjections,
} from "../../db/schema.ts";
import { commitAtomicTrustBatch } from "./persist-event.ts";
import { PROJECTION_VERSION } from "./projections.ts";
import { projectRoleReputation, type ReviewRecord, type ReviewRole } from "./reviews.ts";

function rowToReview(row: typeof reviews.$inferSelect): ReviewRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    reviewerId: row.reviewerId,
    subjectId: row.subjectId,
    role: row.role as ReviewRole,
    visibility: row.visibility as ReviewRecord["visibility"],
    overallScore: row.overallScore,
    body: row.body,
    dimensions: [],
    revealedAt: row.revealedAt,
    removedReason: row.removedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Completed sales/purchases from durable transaction rows only (never legacy itemsSold). */
export async function completedCountsForProfiles(profileIds: string[]) {
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
    counts.set(profileId, {
      sold: soldFromTx.get(profileId) ?? 0,
      bought: boughtFromTx.get(profileId) ?? 0,
      memberSince: profile?.createdAt ?? new Date().toISOString(),
    });
  }

  return counts;
}

export type ProjectionPayload = {
  projectionVersion: string;
  seller: unknown;
  buyer: unknown;
  experienceLabel: string;
};

export async function buildProjectionPayloadForProfile(
  profileId: string,
  opts?: { db?: AppDb; reviewsOverride?: ReviewRecord[] },
): Promise<{ payload: ProjectionPayload; payloadJson: string }> {
  const db = opts?.db ?? (await getDb());
  const now = new Date().toISOString();
  const mapped =
    opts?.reviewsOverride ??
    (await db.select().from(reviews).where(eq(reviews.subjectId, profileId))).map(
      rowToReview,
    );
  const sellerReviews = mapped.filter((r) => r.role === "buyer_reviews_seller");
  const buyerReviews = mapped.filter((r) => r.role === "seller_reviews_buyer");
  const completed = await completedCountsForProfiles([profileId]);
  const stats = completed.get(profileId) ?? {
    sold: 0,
    bought: 0,
    memberSince: now,
  };
  const sellerProj = projectRoleReputation({
    profileId,
    memberSince: stats.memberSince,
    role: "seller",
    reviews: sellerReviews,
    completedCount: stats.sold,
  });
  const buyerProj = projectRoleReputation({
    profileId,
    memberSince: stats.memberSince,
    role: "buyer",
    reviews: buyerReviews,
    completedCount: stats.bought,
  });
  const payload: ProjectionPayload = {
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
  return { payload, payloadJson: JSON.stringify(payload) };
}

export function projectionUpsertQuery(
  db: AppDb,
  input: {
    profileId: string;
    lastEventId: string;
    payloadJson: string;
    calculatedAt: string;
  },
) {
  return db
    .insert(trustProjections)
    .values({
      profileId: input.profileId,
      projectionVersion: PROJECTION_VERSION,
      calculatedAt: input.calculatedAt,
      lastEventId: input.lastEventId,
      payloadJson: input.payloadJson,
    })
    .onConflictDoUpdate({
      target: trustProjections.profileId,
      set: {
        projectionVersion: PROJECTION_VERSION,
        calculatedAt: input.calculatedAt,
        lastEventId: input.lastEventId,
        payloadJson: input.payloadJson,
      },
    });
}

/**
 * Rebuild trust_projections for profiles, binding each row to a signed
 * projection.rebuilt tip event whose payloadHash covers the projection payload.
 */
export async function rebuildAndPersistProjections(
  profileIds: string[],
  opts?: { actorProfileId?: string; occurredAt?: string },
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  const occurredAt = opts?.occurredAt ?? new Date().toISOString();
  if (!uniqueIds.length) return new Map();

  const payloads = new Map<string, { payload: ProjectionPayload; payloadJson: string }>();
  for (const profileId of uniqueIds) {
    payloads.set(profileId, await buildProjectionPayloadForProfile(profileId));
  }

  const { envelopesBySubject } = await commitAtomicTrustBatch({
    subjectEvents: uniqueIds.map((profileId) => ({
      subjectProfileId: profileId,
      events: [
        {
          actorProfileId: opts?.actorProfileId,
          eventType: "projection.rebuilt",
          occurredAt,
          payload: payloads.get(profileId)!.payload,
        },
      ],
    })),
    run: async ({ db, envelopesBySubject, eventInserts }) => {
      const projectionWrites = uniqueIds.map((profileId) => {
        const envelopes = envelopesBySubject.get(profileId)!;
        const tip = envelopes[envelopes.length - 1]!;
        return projectionUpsertQuery(db, {
          profileId,
          lastEventId: tip.eventId,
          payloadJson: payloads.get(profileId)!.payloadJson,
          calculatedAt: occurredAt,
        });
      });
      await db.batch([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(eventInserts as any[]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(projectionWrites as any[]),
      ]);
    },
  });

  const lastEventIds = new Map<string, string>();
  for (const profileId of uniqueIds) {
    const envelopes = envelopesBySubject.get(profileId)!;
    lastEventIds.set(profileId, envelopes[envelopes.length - 1]!.eventId);
  }
  return lastEventIds;
}
