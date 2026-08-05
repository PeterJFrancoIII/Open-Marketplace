import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, profiles, socialConnections } from "../../../db/schema";
import { checkSocialAccounts } from "../../../lib/social-health";
import {
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  parseStrictListingWrite,
  rateLimit,
} from "../../../lib/trust";
import type { SocialProof } from "../../../lib/types";

function parseSocialAccounts(raw: string | null | undefined): SocialProof[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as SocialProof[]) : [];
  } catch {
    return [];
  }
}

/** Merge oauth_verified social_connections into listing/profile social proofs. */
function enrichSocialProofsWithOAuth(
  proofs: SocialProof[],
  connections: Array<{
    provider: string;
    canonicalUrl: string;
    handle: string | null;
    status: string;
    accountCreatedAt: string | null;
    connectionCount: number | null;
    connectionLabel: string | null;
    verifiedAt: string | null;
    lastSuccessfulRefreshAt: string | null;
  }>,
): SocialProof[] {
  const oauthByProvider = new Map(
    connections
      .filter((c) => c.status === "oauth_verified")
      .map((c) => [c.provider, c] as const),
  );
  if (!oauthByProvider.size) return proofs;

  const next = proofs.map((proof) => {
    const oauth = oauthByProvider.get(proof.provider);
    if (!oauth) return proof;
    oauthByProvider.delete(proof.provider);
    return {
      ...proof,
      url: oauth.canonicalUrl || proof.url,
      handle: oauth.handle ?? proof.handle,
      metricsSource: "oauth" as const,
      health: proof.health === "dead" || proof.health === "invalid" ? proof.health : "active",
      accountCreatedAt: oauth.accountCreatedAt ?? proof.accountCreatedAt,
      connectionCount: oauth.connectionCount ?? proof.connectionCount,
      connectionLabel:
        (oauth.connectionLabel as SocialProof["connectionLabel"]) ?? proof.connectionLabel,
      lastCheckedAt: oauth.lastSuccessfulRefreshAt ?? oauth.verifiedAt ?? proof.lastCheckedAt,
    };
  });

  for (const [provider, oauth] of oauthByProvider) {
    next.push({
      provider: provider as SocialProof["provider"],
      url: oauth.canonicalUrl,
      handle: oauth.handle ?? undefined,
      metricsSource: "oauth",
      health: "active",
      accountCreatedAt: oauth.accountCreatedAt ?? undefined,
      connectionCount: oauth.connectionCount ?? undefined,
      connectionLabel: (oauth.connectionLabel as SocialProof["connectionLabel"]) ?? undefined,
      lastCheckedAt: oauth.lastSuccessfulRefreshAt ?? oauth.verifiedAt ?? undefined,
    });
  }
  return next;
}

const conditions = ["New", "Like new", "Good", "Fair"] as const;
const formats = ["Fixed price", "Auction"] as const;
const deliveryMethods = ["Pickup", "Shipping", "Both"] as const;
const restrictedTerms = [
  "firearm",
  "ammunition",
  "explosive",
  "silencer",
  "controlled substance",
];

function registryError(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof InvalidTrustTransitionError) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable = message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    {
      error: unavailable ? "registry_unavailable" : "registry_error",
      message: unavailable
        ? "The metadata registry is not initialized yet."
        : "The metadata registry could not complete this request.",
    },
    { status: unavailable ? 503 : 500 },
  );
}

function boundedInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const condition = url.searchParams.get("condition")?.trim() ?? "";
    const format = url.searchParams.get("format")?.trim() ?? "";
    const delivery = url.searchParams.get("delivery")?.trim() ?? "";
    const minimum = Number(url.searchParams.get("minPriceCents"));
    const maximum = Number(url.searchParams.get("maxPriceCents"));
    const sort = url.searchParams.get("sort") ?? "newest";
    const limit = boundedInteger(url.searchParams.get("limit"), 40, 100);

    const filters: SQL[] = [eq(listings.status, "active")];
    if (query) {
      const pattern = `%${query.slice(0, 80)}%`;
      const searchFilter = or(
        like(listings.title, pattern),
        like(listings.description, pattern),
        like(listings.category, pattern),
        like(listings.locationLabel, pattern),
      );
      if (searchFilter) filters.push(searchFilter);
    }
    if (category) filters.push(eq(listings.category, category));
    if (condition) filters.push(eq(listings.condition, condition));
    if (format) filters.push(eq(listings.format, format));
    if (delivery) {
      const deliveryFilter = or(eq(listings.delivery, delivery), eq(listings.delivery, "Both"));
      if (deliveryFilter) filters.push(deliveryFilter);
    }
    if (Number.isFinite(minimum) && minimum >= 0) filters.push(gte(listings.priceCents, minimum));
    if (Number.isFinite(maximum) && maximum >= 0) filters.push(lte(listings.priceCents, maximum));

    const order =
      sort === "price-low"
        ? asc(listings.priceCents)
        : sort === "price-high"
          ? desc(listings.priceCents)
          : sort === "ending"
            ? asc(listings.endingAt)
            : sort === "distance"
              ? asc(listings.distanceMiles)
              : desc(listings.createdAt);

    const db = await getDb();
    const rows = await db
      .select({ listing: listings, profile: profiles })
      .from(listings)
      .leftJoin(profiles, eq(profiles.id, listings.sellerId))
      .where(and(...filters))
      .orderBy(order, desc(listings.id))
      .limit(limit);

    const sellerIds = [
      ...new Set(rows.map(({ listing }) => listing.sellerId).filter(Boolean)),
    ];
    const oauthRows =
      sellerIds.length > 0
        ? await db
            .select()
            .from(socialConnections)
            .where(
              and(
                inArray(socialConnections.profileId, sellerIds),
                eq(socialConnections.status, "oauth_verified"),
              ),
            )
        : [];
    const oauthBySeller = new Map<string, typeof oauthRows>();
    for (const row of oauthRows) {
      const list = oauthBySeller.get(row.profileId) ?? [];
      list.push(row);
      oauthBySeller.set(row.profileId, list);
    }

    return Response.json({
      listings: rows.map(({ listing, profile }) => {
        const baseProofs = parseSocialAccounts(
          profile?.socialAccountsJson ?? listing.socialProofsJson,
        );
        const enriched = enrichSocialProofsWithOAuth(
          baseProofs,
          oauthBySeller.get(listing.sellerId) ?? [],
        );
        return {
          ...listing,
          sellerName: profile?.displayName ?? listing.sellerName,
          socialProofsJson: JSON.stringify(enriched),
          itemsSold: profile?.itemsSold ?? 0,
          sellerRating: profile?.sellerRating ?? null,
          sellerRatingCount: profile?.sellerRatingCount ?? 0,
          buyerRating: profile?.buyerRating ?? null,
          buyerRatingCount: profile?.buyerRatingCount ?? 0,
        };
      }),
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `listing:create:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const payload = await request.json();
    const write = parseStrictListingWrite(payload);
    // Seller identity is always the server session — never caller-chosen.
    const ownedSellerId = actor.profileId;
    const title = write.title;
    const description = write.description;
    const category = write.category;
    const locationLabel = write.locationLabel;
    const sellerName = write.sellerName;
    const priceCents = write.priceCents;
    const condition = write.condition;
    const format = write.format;
    const delivery = write.delivery;
    const socialProofs = write.socialProofs.slice(0, 3) as SocialProof[];
    const imageManifest = write.imageManifest;

    if (!conditions.includes(condition as (typeof conditions)[number])) {
      return Response.json({ error: "Unsupported condition." }, { status: 400 });
    }
    if (!formats.includes(format as (typeof formats)[number])) {
      return Response.json({ error: "Unsupported buying format." }, { status: 400 });
    }
    if (!deliveryMethods.includes(delivery as (typeof deliveryMethods)[number])) {
      return Response.json({ error: "Unsupported fulfillment method." }, { status: 400 });
    }
    const policyText = `${title} ${description}`.toLowerCase();
    if (restrictedTerms.some((term) => policyText.includes(term))) {
      return Response.json({ error: "This instance does not accept restricted items." }, { status: 422 });
    }

    const checkedSocialProofs = await checkSocialAccounts(socialProofs);
    const brokenAccount = checkedSocialProofs.find(
      (account) => account.health === "dead" || account.health === "invalid",
    );
    if (brokenAccount) {
      return Response.json(
        {
          error: "Fix or remove the unavailable social profile before publishing.",
          account: brokenAccount,
        },
        { status: 422 },
      );
    }

    const id = crypto.randomUUID();
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db
      .insert(profiles)
      .values({
        id: ownedSellerId,
        displayName: sellerName,
        socialAccountsJson: JSON.stringify(checkedSocialProofs),
        updatedAt,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          displayName: sellerName,
          socialAccountsJson: JSON.stringify(checkedSocialProofs),
          updatedAt,
        },
      });

    const [created] = await db
      .insert(listings)
      .values({
        id,
        title,
        description,
        priceCents,
        currency: write.currency === "USD" ? "USD" : "USD",
        condition,
        category,
        locationLabel,
        distanceMiles: null,
        format,
        delivery,
        sellerId: ownedSellerId,
        sellerName,
        socialProofsJson: JSON.stringify(checkedSocialProofs),
        imageManifestJson: JSON.stringify(imageManifest),
        endingAt: write.endingAt,
      })
      .returning();

    return Response.json(
      {
        listing: {
          ...created,
          itemsSold: 0,
          sellerRating: null,
          sellerRatingCount: 0,
          buyerRating: null,
          buyerRatingCount: 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return registryError(error);
  }
}
