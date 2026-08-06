import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { trustEvents, trustProjections } from "../../db/schema";
import { PortableTrustError } from "./portable/keys.ts";

export type TrustedProjectionSnapshot = {
  sellerCompletedSales: number;
  sellerDisplayMean: number | null;
  sellerRatingCount: number;
  buyerDisplayMean: number | null;
  buyerRatingCount: number;
  lastEventId: string;
  calculatedAt: string;
  projectionVersion: string;
};

/**
 * Load a projection only when lastEventId points at a signed (non-unsigned)
 * trust event for the same subject. Otherwise refuse — never mint native claims
 * from unverified projection rows.
 */
export async function loadProvenProjection(
  profileId: string,
): Promise<TrustedProjectionSnapshot | null> {
  const db = await getDb();
  const [projection] = await db
    .select()
    .from(trustProjections)
    .where(eq(trustProjections.profileId, profileId))
    .limit(1);
  if (!projection?.lastEventId || !projection.payloadJson) return null;

  const [event] = await db
    .select()
    .from(trustEvents)
    .where(
      and(
        eq(trustEvents.id, projection.lastEventId),
        eq(trustEvents.subjectProfileId, profileId),
        ne(trustEvents.signature, ""),
      ),
    )
    .limit(1);

  if (!event || event.signature.startsWith("unsigned:")) {
    return null;
  }

  try {
    const payload = JSON.parse(projection.payloadJson) as {
      seller?: {
        completedSales?: number;
        displayMean?: number | null;
        ratingCount?: number;
      };
      buyer?: {
        displayMean?: number | null;
        ratingCount?: number;
      };
    };
    return {
      sellerCompletedSales: Number(payload.seller?.completedSales ?? 0),
      sellerDisplayMean: payload.seller?.displayMean ?? null,
      sellerRatingCount: Number(payload.seller?.ratingCount ?? 0),
      buyerDisplayMean: payload.buyer?.displayMean ?? null,
      buyerRatingCount: Number(payload.buyer?.ratingCount ?? 0),
      lastEventId: projection.lastEventId,
      calculatedAt: projection.calculatedAt,
      projectionVersion: projection.projectionVersion,
    };
  } catch {
    return null;
  }
}

export async function requireProvenProjection(
  profileId: string,
): Promise<TrustedProjectionSnapshot> {
  const snapshot = await loadProvenProjection(profileId);
  if (!snapshot) {
    throw new PortableTrustError(
      "No provenance-backed trust projection (signed lastEventId required)",
      409,
    );
  }
  return snapshot;
}
