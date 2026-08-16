import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, profiles } from "../../../db/schema";
import { getMarketplaceSession } from "../../../lib/auth";
import { parsePaymentDestinationsJson } from "../../../lib/payment-destinations";
import { parseSocialAccountsJson } from "../../../lib/profile-settings";
import { checkSocialAccounts } from "../../../lib/social-health";
import type { SocialProof } from "../../../lib/types";

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

    return Response.json({
      listings: rows.map(({ listing, profile }) => ({
        ...listing,
        sellerName: profile?.displayName ?? listing.sellerName,
        socialProofsJson:
          profile?.socialAccountsJson ?? listing.socialProofsJson,
        paymentDestinationsJson: JSON.stringify(
          parsePaymentDestinationsJson(profile?.paymentDestinationsJson),
        ),
        itemsSold: profile?.itemsSold ?? 0,
        sellerRating: profile?.sellerRating ?? null,
        sellerRatingCount: profile?.sellerRatingCount ?? 0,
        buyerRating: profile?.buyerRating ?? null,
        buyerRatingCount: profile?.buyerRatingCount ?? 0,
      })),
    });
  } catch (error) {
    return registryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getMarketplaceSession(request);
    if (!session) {
      return Response.json(
        { error: "Log in to publish a listing." },
        { status: 401 },
      );
    }

    const sellerId = session.user.id;
    const sellerName = session.user.name;
    const payload = (await request.json()) as Record<string, unknown>;
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const description =
      typeof payload.description === "string" ? payload.description.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const locationLabel =
      typeof payload.locationLabel === "string" ? payload.locationLabel.trim() : "";
    const priceCents = Number(payload.priceCents);
    const condition = String(payload.condition ?? "");
    const format = String(payload.format ?? "");
    const delivery = String(payload.delivery ?? "");
    const incomingSocialProofs = Array.isArray(payload.socialProofs)
      ? (payload.socialProofs as SocialProof[])
          .filter((account) => typeof account?.url === "string" && account.url.trim())
          .slice(0, 3)
          .map((account) => ({ ...account, metricsSource: "self-reported" as const }))
      : [];
    const imageManifest = Array.isArray(payload.imageManifest)
      ? payload.imageManifest.slice(0, 6)
      : [];

    if (!title || title.length > 90) {
      return Response.json({ error: "A title of 1–90 characters is required." }, { status: 400 });
    }
    if (!description || description.length > 1400) {
      return Response.json({ error: "A description of 1–1400 characters is required." }, { status: 400 });
    }
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 1_000_000_000) {
      return Response.json({ error: "A valid price is required." }, { status: 400 });
    }
    if (!category || !locationLabel || !sellerId || !sellerName) {
      return Response.json({ error: "Category, area, and seller identity are required." }, { status: 400 });
    }
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

    const db = await getDb();
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, sellerId))
      .limit(1);
    const storedSocialProofs = parseSocialAccountsJson(
      existingProfile?.socialAccountsJson,
    );
    const socialSource = incomingSocialProofs.length
      ? incomingSocialProofs
      : storedSocialProofs;
    const checkedSocialProofs = socialSource.length
      ? (await checkSocialAccounts(socialSource)).map((account) => ({
          ...account,
          metricsSource: "self-reported" as const,
        }))
      : [];
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
    const updatedAt = new Date().toISOString();
    const socialAccountsJson = JSON.stringify(
      incomingSocialProofs.length ? checkedSocialProofs : storedSocialProofs,
    );
    const paymentDestinationsJson = JSON.stringify(
      parsePaymentDestinationsJson(existingProfile?.paymentDestinationsJson),
    );
    await db
      .insert(profiles)
      .values({
        id: sellerId,
        displayName: sellerName,
        socialAccountsJson,
        paymentDestinationsJson,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          displayName: sellerName,
          ...(incomingSocialProofs.length ? { socialAccountsJson } : {}),
          updatedAt,
        },
      });

    const [listing] = await db
      .insert(listings)
      .values({
        id,
        title,
        description,
        priceCents,
        currency: payload.currency === "USD" ? "USD" : "USD",
        condition,
        category,
        locationLabel,
        distanceMiles: null,
        format,
        delivery,
        sellerId,
        sellerName,
        socialProofsJson: JSON.stringify(checkedSocialProofs),
        imageManifestJson: JSON.stringify(imageManifest),
        endingAt: typeof payload.endingAt === "string" ? payload.endingAt : null,
      })
      .returning();

    return Response.json(
      {
        listing: {
          ...listing,
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
