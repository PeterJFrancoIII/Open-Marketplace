import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { profiles } from "../../../../../db/schema";
import { AuthError, rateLimit } from "../../../../../lib/trust";
import { loadProvenProjection } from "../../../../../lib/trust/projection-provenance.ts";

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
      message,
    },
    { status: unavailable ? 503 : 500 },
  );
}

export async function GET(request: Request, context: Params) {
  try {
    const { id: profileId } = await context.params;
    const limited = rateLimit({
      key: `trust:read:${profileId}`,
      limit: 120,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const db = await getDb();
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const proven = await loadProvenProjection(profileId);
    if (!proven) {
      return Response.json({
        profileId,
        displayName: profile.displayName,
        projectionVersion: null,
        calculatedAt: null,
        facets: {
          seller: null,
          buyer: null,
          experienceLabel: "New",
        },
        disclosures: [
          "Seller and buyer reputation are separate.",
          "No provenance-backed projection is published for this profile yet.",
          "Native ratings require a signed trust-event lastEventId.",
        ],
      });
    }

    return Response.json({
      profileId,
      displayName: profile.displayName,
      projectionVersion: proven.projectionVersion,
      calculatedAt: proven.calculatedAt,
      lastEventId: proven.lastEventId,
      facets: {
        seller: {
          completedSales: proven.sellerCompletedSales,
          displayMean: proven.sellerDisplayMean,
          ratingCount: proven.sellerRatingCount,
        },
        buyer: {
          displayMean: proven.buyerDisplayMean,
          ratingCount: proven.buyerRatingCount,
        },
      },
      disclosures: [
        "Seller and buyer reputation are separate.",
        "Scores show count and window; never a universal trust score.",
        "Only revealed, transaction-bound reviews with signed events affect aggregates.",
      ],
    });
  } catch (error) {
    return registryError(error);
  }
}
