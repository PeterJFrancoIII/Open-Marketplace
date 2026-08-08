import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { profiles, socialConnections, trustEvents } from "../../../../../../db/schema";
import {
  AuthError,
  parseActor,
  rateLimit,
  type TrustEventEnvelope,
} from "../../../../../../lib/trust";
import {
  buildSignedTrustBundle,
  PortableTrustError,
  requireMatchingRegistryKeypair,
} from "../../../../../../lib/trust/portable/index.ts";
import { requireProvenProjection } from "../../../../../../lib/trust/projection-provenance.ts";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PortableTrustError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable =
    message.includes("no such table") ||
    message.includes("binding `DB`") ||
    message.includes("not configured") ||
    message.includes("JWK");
  return Response.json(
    { error: unavailable ? "export_unavailable" : "export_error", message },
    { status: unavailable ? 503 : 500 },
  );
}

export async function GET(request: Request, context: Params) {
  try {
    const { id: profileId } = await context.params;
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    if (actor.profileId !== profileId && !actor.isModerator) {
      return Response.json(
        { error: "Only the profile owner or a moderator may export trust bundles" },
        { status: 403 },
      );
    }

    const limited = rateLimit({
      key: `trust:export:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const keys = await requireMatchingRegistryKeypair({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });

    const db = await getDb();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    // Native portable claims require a provenance-backed projection.
    const projection = await requireProvenProjection(profileId);

    const eventRows = await db
      .select()
      .from(trustEvents)
      .where(eq(trustEvents.subjectProfileId, profileId))
      .limit(500);
    const events: TrustEventEnvelope[] = eventRows
      .filter((row) => row.signature && !row.signature.startsWith("unsigned:"))
      .map((row) => ({
        eventId: row.id,
        subjectProfileId: row.subjectProfileId,
        actorProfileId: row.actorProfileId ?? undefined,
        eventType: row.eventType,
        occurredAt: row.occurredAt,
        payloadHash: row.payloadHash,
        // Match signer genesis sentinel (omit empty string).
        priorEventHash: row.priorEventHash || undefined,
        priorEventId: row.priorEventId || undefined,
        registryId: row.registryId,
        schemaVersion: row.schemaVersion,
        signature: row.signature,
      }));

    const oauthRows = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.profileId, profileId))
      .limit(20);
    const oauthConnection = oauthRows.find((row) => row.status === "oauth_verified");
    const providerConnectedAt =
      oauthConnection?.verifiedAt ?? oauthConnection?.lastSuccessfulRefreshAt ?? null;

    const bundle = await buildSignedTrustBundle({
      registryId: keys.registryId,
      keyId: keys.keyId,
      privateKey: keys.privateKey,
      subjectProfileId: profileId,
      events,
      snapshot: {
        memberSince: profile.createdAt,
        sellerCompletedSales: projection.sellerCompletedSales,
        sellerDisplayMean: projection.sellerDisplayMean,
        sellerRatingCount: projection.sellerRatingCount,
        buyerDisplayMean: projection.buyerDisplayMean,
        buyerRatingCount: projection.buyerRatingCount,
        providerConnectedAt,
      },
    });

    return Response.json({
      ...bundle,
      disclosures: [
        ...bundle.disclosures,
        `Projection provenance via signed trust event ${projection.lastEventId}.`,
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
