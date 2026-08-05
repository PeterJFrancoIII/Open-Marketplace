import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { profiles, reviews, trustProjections } from "../../../../../db/schema";
import {
  AuthError,
  parseActor,
  projectRoleReputation,
  rateLimit,
  type ReviewRecord,
  type ReviewRole,
} from "../../../../../lib/trust";
import { PROJECTION_VERSION } from "../../../../../lib/trust/projections.ts";

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
    parseActor(request, process.env.MODERATOR_TOKEN ?? null);
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

    const [stored] = await db
      .select()
      .from(trustProjections)
      .where(eq(trustProjections.profileId, profileId))
      .limit(1);

    if (stored) {
      const payload = JSON.parse(stored.payloadJson) as Record<string, unknown>;
      return Response.json({
        profileId,
        displayName: profile.displayName,
        projectionVersion: stored.projectionVersion,
        calculatedAt: stored.calculatedAt,
        facets: payload,
        disclosures: [
          "Seller and buyer reputation are separate.",
          "Scores show count and window; never a universal trust score.",
          "Only revealed, transaction-bound reviews affect aggregates.",
        ],
      });
    }

    // Live recompute from revealed reviews when no cached projection exists.
    const rows = await db.select().from(reviews).where(eq(reviews.subjectId, profileId));
    const mapped: ReviewRecord[] = rows.map((r) => ({
      id: r.id,
      transactionId: r.transactionId,
      reviewerId: r.reviewerId,
      subjectId: r.subjectId,
      role: r.role as ReviewRole,
      visibility: r.visibility as ReviewRecord["visibility"],
      overallScore: r.overallScore,
      body: r.body,
      dimensions: [],
      revealedAt: r.revealedAt,
      removedReason: r.removedReason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
    const sellerReviews = mapped.filter((r) => r.role === "buyer_reviews_seller");
    const buyerReviews = mapped.filter((r) => r.role === "seller_reviews_buyer");
    const sellerProj = projectRoleReputation({
      profileId,
      memberSince: profile.createdAt,
      role: "seller",
      reviews: sellerReviews,
      completedCount: profile.itemsSold,
    });
    const buyerProj = projectRoleReputation({
      profileId,
      memberSince: profile.createdAt,
      role: "buyer",
      reviews: buyerReviews,
      completedCount: buyerReviews.filter((r) => r.visibility === "revealed").length,
    });

    return Response.json({
      profileId,
      displayName: profile.displayName,
      projectionVersion: PROJECTION_VERSION,
      calculatedAt: new Date().toISOString(),
      facets: {
        seller: "seller" in sellerProj ? sellerProj.seller : null,
        buyer: "buyer" in buyerProj ? buyerProj.buyer : null,
        experienceLabel:
          "experienceLabel" in sellerProj ? sellerProj.experienceLabel : "New",
        // Legacy demo fields kept as fallback labels with counts — not a trust score.
        legacy: {
          itemsSold: profile.itemsSold,
          sellerRating: profile.sellerRating,
          sellerRatingCount: profile.sellerRatingCount,
          buyerRating: profile.buyerRating,
          buyerRatingCount: profile.buyerRatingCount,
        },
      },
      disclosures: [
        "Seller and buyer reputation are separate.",
        "Scores show count and window; never a universal trust score.",
        "Only revealed, transaction-bound reviews affect aggregates.",
      ],
    });
  } catch (error) {
    return registryError(error);
  }
}
