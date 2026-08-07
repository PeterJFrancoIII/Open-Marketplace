import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { trustEvents, trustProjections } from "../../db/schema.ts";
import { canonicalize, sha256Hex } from "./portable/canonicalize.ts";
import { verifyTrustEventEnvelope } from "./portable/bundle.ts";
import {
  importPublicJwk,
  parseJwkEnv,
  PortableTrustError,
} from "./portable/keys.ts";
import type { TrustEventEnvelope } from "./types.ts";

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

async function loadRegistryPublicKey(): Promise<CryptoKey> {
  const jwk = parseJwkEnv(process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK);
  if (!jwk) {
    throw new PortableTrustError("Registry public JWK is not configured", 503);
  }
  return importPublicJwk(jwk);
}

/**
 * Load a projection only when lastEventId is a verified projection.rebuilt
 * event whose payloadHash binds to payloadJson. Never trust unsigned or
 * unbound projection rows.
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
      ),
    )
    .limit(1);

  if (!event || event.eventType !== "projection.rebuilt") {
    return null;
  }
  if (!event.signature || event.signature.startsWith("unsigned:")) {
    return null;
  }

  let parsed: {
    seller?: {
      completedSales?: number;
      displayMean?: number | null;
      ratingCount?: number;
    };
    buyer?: {
      displayMean?: number | null;
      ratingCount?: number;
    };
    projectionVersion?: string;
  };
  try {
    parsed = JSON.parse(projection.payloadJson) as typeof parsed;
  } catch {
    return null;
  }

  const boundHash = await sha256Hex(canonicalize(parsed));
  if (boundHash !== event.payloadHash) {
    return null;
  }

  const envelope: TrustEventEnvelope = {
    eventId: event.id,
    subjectProfileId: event.subjectProfileId,
    actorProfileId: event.actorProfileId ?? undefined,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payloadHash: event.payloadHash,
    priorEventHash: event.priorEventHash || undefined,
    registryId: event.registryId,
    schemaVersion: event.schemaVersion,
    signature: event.signature,
  };

  try {
    const publicKey = await loadRegistryPublicKey();
    const ok = await verifyTrustEventEnvelope({ envelope, publicKey });
    if (!ok) return null;
  } catch {
    return null;
  }

  return {
    sellerCompletedSales: Number(parsed.seller?.completedSales ?? 0),
    sellerDisplayMean: parsed.seller?.displayMean ?? null,
    sellerRatingCount: Number(parsed.seller?.ratingCount ?? 0),
    buyerDisplayMean: parsed.buyer?.displayMean ?? null,
    buyerRatingCount: Number(parsed.buyer?.ratingCount ?? 0),
    lastEventId: projection.lastEventId,
    calculatedAt: projection.calculatedAt,
    projectionVersion: projection.projectionVersion,
  };
}

export async function requireProvenProjection(
  profileId: string,
): Promise<TrustedProjectionSnapshot> {
  const snapshot = await loadProvenProjection(profileId);
  if (!snapshot) {
    throw new PortableTrustError(
      "No provenance-backed trust projection (verified projection.rebuilt required)",
      409,
    );
  }
  return snapshot;
}
