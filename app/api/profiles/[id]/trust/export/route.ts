import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { profiles, socialConnections, trustEvents } from "../../../../../../db/schema";
import {
  AuthError,
  buildSignedTrustBundle,
  loadRegistrySignerFromEnv,
  parseActor,
  PortableTrustError,
  rateLimit,
  type TrustEventEnvelope,
} from "../../../../../../lib/trust";

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
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
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

    const signer = await loadRegistrySignerFromEnv({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });
    if (!signer.privateKey || !signer.keyId) {
      throw new PortableTrustError(
        "REGISTRY_SIGNING_PRIVATE_JWK is required to export signed trust bundles",
        503,
      );
    }

    const db = await getDb();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const eventRows = await db
      .select()
      .from(trustEvents)
      .where(eq(trustEvents.subjectProfileId, profileId))
      .limit(500);
    const events: TrustEventEnvelope[] = eventRows.map((row) => ({
      eventId: row.id,
      subjectProfileId: row.subjectProfileId,
      actorProfileId: row.actorProfileId ?? undefined,
      eventType: row.eventType,
      occurredAt: row.occurredAt,
      payloadHash: row.payloadHash,
      priorEventHash: row.priorEventHash ?? undefined,
      registryId: row.registryId,
      schemaVersion: row.schemaVersion,
      signature: row.signature,
    }));

    const [oauthConnection] = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.profileId, profileId))
      .limit(20);
    const providerConnectedAt =
      oauthConnection?.status === "oauth_verified"
        ? oauthConnection.verifiedAt ?? oauthConnection.lastSuccessfulRefreshAt
        : null;

    const bundle = await buildSignedTrustBundle({
      registryId: signer.registryId,
      keyId: signer.keyId,
      privateKey: signer.privateKey,
      subjectProfileId: profileId,
      events,
      snapshot: {
        memberSince: profile.createdAt,
        sellerCompletedSales: profile.itemsSold,
        sellerDisplayMean: profile.sellerRating,
        sellerRatingCount: profile.sellerRatingCount,
        buyerDisplayMean: profile.buyerRating,
        buyerRatingCount: profile.buyerRatingCount,
        providerConnectedAt,
      },
    });

    return Response.json(bundle);
  } catch (error) {
    return errorResponse(error);
  }
}
