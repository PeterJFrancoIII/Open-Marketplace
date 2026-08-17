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
import { authAccounts, listings, profiles, saleHistory } from "../../../db/schema";
import { getMarketplaceSession, persistFacebookProfileLink } from "../../../lib/auth";
import {
  isConnectedFacebookProof,
  mergeConnectedFacebookProof,
  publicFacebookProfileUrl,
} from "../../../lib/facebook-listing-proof";
import { overlayPaypalDestinations } from "../../../lib/paypal-public";
import { sanitizeImageManifest } from "../../../lib/image-manifest";
import { parsePaymentDestinationsJson } from "../../../lib/payment-destinations";
import {
  attachPackageToDescription,
  normalizeShippingPackage,
  stripPackageFromDescription,
} from "../../../lib/shipping-package";
import { parseSocialAccountsJson } from "../../../lib/profile-settings";
import { checkSocialAccounts } from "../../../lib/social-health";

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

function optionalPriceCents(value: string | null) {
  if (value == null || value.trim() === "") return Number.NaN;
  return Number(value);
}

async function connectedProviderUserIds(
  db: Awaited<ReturnType<typeof getDb>>,
  providerId: "facebook" | "paypal",
  userIds: string[],
) {
  if (!userIds.length) return new Set<string>();
  const rows = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.providerId, providerId),
        inArray(authAccounts.userId, userIds),
      ),
    );
  return new Set(rows.map((row) => row.userId));
}

function publicPaymentDestinations(
  profilePaymentJson: string | null | undefined,
  paypalConnected: boolean,
) {
  return overlayPaypalDestinations(
    parsePaymentDestinationsJson(profilePaymentJson),
    paypalConnected,
  );
}

async function refreshMissingFacebookProfileLinks(
  db: Awaited<ReturnType<typeof getDb>>,
  sellerIds: string[],
  facebookSellerIds: Set<string>,
  profileById: Map<string, (typeof profiles)["$inferSelect"]>,
  rows: Array<{ sellerId: string; sellerName: string }>,
) {
  const missing = sellerIds.filter((sellerId) => {
    if (!facebookSellerIds.has(sellerId)) return false;
    const accounts = parseSocialAccountsJson(
      profileById.get(sellerId)?.socialAccountsJson,
    );
    return !publicFacebookProfileUrl(
      accounts.find(isConnectedFacebookProof)?.url,
    );
  });
  if (!missing.length) return profileById;
  await Promise.all(
    missing.map((sellerId) =>
      persistFacebookProfileLink(
        sellerId,
        profileById.get(sellerId)?.displayName ??
          rows.find((row) => row.sellerId === sellerId)?.sellerName ??
          "Facebook",
      ),
    ),
  );
  const refreshed = await db
    .select()
    .from(profiles)
    .where(inArray(profiles.id, missing));
  const next = new Map(profileById);
  for (const profile of refreshed) {
    next.set(profile.id, profile);
  }
  return next;
}

function compactSoldListing(
  listing: typeof listings.$inferSelect,
  sellerName: string,
  soldAt: string,
) {
  return {
    archive: true,
    id: listing.id,
    title: listing.title,
    priceCents: listing.priceCents,
    currency: listing.currency,
    status: "sold",
    soldAt,
    sellerName,
    createdAt: listing.createdAt,
  };
}

function publicSocialProofsJson(
  profileSocialJson: string | null | undefined,
  facebookConnected: boolean,
  sellerName: string,
) {
  return JSON.stringify(
    mergeConnectedFacebookProof(
      parseSocialAccountsJson(profileSocialJson),
      facebookConnected,
      sellerName,
    ),
  );
}

function parseListingWrite(payload: Record<string, unknown>) {
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
  const imageManifest = sanitizeImageManifest(payload.imageManifest);

  if (!title || title.length > 90) {
    return {
      ok: false as const,
      response: Response.json({ error: "A title of 1–90 characters is required." }, { status: 400 }),
    };
  }
  if (!description || description.length > 1400) {
    return {
      ok: false as const,
      response: Response.json({ error: "A description of 1–1400 characters is required." }, { status: 400 }),
    };
  }
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 1_000_000_000) {
    return {
      ok: false as const,
      response: Response.json({ error: "A valid price is required." }, { status: 400 }),
    };
  }
  if (!category || !locationLabel) {
    return {
      ok: false as const,
      response: Response.json({ error: "Category, area, and seller identity are required." }, { status: 400 }),
    };
  }
  if (!conditions.includes(condition as (typeof conditions)[number])) {
    return {
      ok: false as const,
      response: Response.json({ error: "Unsupported condition." }, { status: 400 }),
    };
  }
  if (!formats.includes(format as (typeof formats)[number])) {
    return {
      ok: false as const,
      response: Response.json({ error: "Unsupported buying format." }, { status: 400 }),
    };
  }
  if (!deliveryMethods.includes(delivery as (typeof deliveryMethods)[number])) {
    return {
      ok: false as const,
      response: Response.json({ error: "Unsupported fulfillment method." }, { status: 400 }),
    };
  }
  let shippingPackage = null;
  if (delivery === "Shipping" || delivery === "Both") {
    if (payload.shippingPackage != null) {
      const normalizedPackage = normalizeShippingPackage(payload.shippingPackage);
      if (!normalizedPackage.ok) {
        return {
          ok: false as const,
          response: Response.json({ error: normalizedPackage.error }, { status: 400 }),
        };
      }
      shippingPackage = normalizedPackage.package;
    }
  }
  const policyText = `${title} ${description}`.toLowerCase();
  if (restrictedTerms.some((term) => policyText.includes(term))) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "This instance does not accept restricted items." },
        { status: 422 },
      ),
    };
  }

  return {
    ok: true as const,
    title,
    description,
    category,
    locationLabel,
    priceCents,
    condition,
    format,
    delivery,
    imageManifest,
    shippingPackage,
    endingAt: typeof payload.endingAt === "string" ? payload.endingAt : null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const condition = url.searchParams.get("condition")?.trim() ?? "";
    const format = url.searchParams.get("format")?.trim() ?? "";
    const delivery = url.searchParams.get("delivery")?.trim() ?? "";
    const minimum = optionalPriceCents(url.searchParams.get("minPriceCents"));
    const maximum = optionalPriceCents(url.searchParams.get("maxPriceCents"));
    const sort = url.searchParams.get("sort") ?? "newest";
    const listingId = url.searchParams.get("id")?.trim() ?? "";
    const limit = boundedInteger(url.searchParams.get("limit"), 40, 100);

    const filters: SQL[] = listingId
      ? [eq(listings.id, listingId.slice(0, 80))]
      : [eq(listings.status, "active")];
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
      .select()
      .from(listings)
      .where(and(...filters))
      .orderBy(order, desc(listings.id))
      .limit(limit);
    const sellerIds = [...new Set(rows.map((listing) => listing.sellerId))];
    const profileRows = sellerIds.length
      ? await db
          .select()
          .from(profiles)
          .where(inArray(profiles.id, sellerIds))
      : [];
    const [facebookSellerIds, paypalSellerIds] = await Promise.all([
      connectedProviderUserIds(db, "facebook", sellerIds),
      connectedProviderUserIds(db, "paypal", sellerIds),
    ]);
    const profileById = await refreshMissingFacebookProfileLinks(
      db,
      sellerIds,
      facebookSellerIds,
      new Map(profileRows.map((profile) => [profile.id, profile])),
      rows,
    );
    const soldIds = rows
      .filter((listing) => listing.status === "sold")
      .map((listing) => listing.id);
    const saleRows = soldIds.length
      ? await db
          .select()
          .from(saleHistory)
          .where(inArray(saleHistory.listingId, soldIds))
      : [];
    const soldAtByListing = new Map(
      saleRows.map((sale) => [sale.listingId, sale.soldAt]),
    );

    return Response.json({
      listings: rows.map((listing) => {
        const profile = profileById.get(listing.sellerId);
        const sellerName = profile?.displayName ?? listing.sellerName;
        if (listingId && listing.status === "sold") {
          return compactSoldListing(
            listing,
            sellerName,
            soldAtByListing.get(listing.id) ?? listing.updatedAt,
          );
        }
        const unpacked = stripPackageFromDescription(listing.description);
        const paypalLinked = paypalSellerIds.has(listing.sellerId);
        const paymentDestinations = publicPaymentDestinations(
          profile?.paymentDestinationsJson,
          paypalLinked,
        );
        return {
          ...listing,
          description: unpacked.description,
          shippingPackage: unpacked.package,
          sellerName,
          socialProofsJson: publicSocialProofsJson(
            profile?.socialAccountsJson ?? listing.socialProofsJson,
            facebookSellerIds.has(listing.sellerId),
            sellerName,
          ),
          paymentDestinationsJson: JSON.stringify(paymentDestinations),
          paymentDestinations,
          paypalLinked,
          itemsSold: profile?.itemsSold ?? 0,
          sellerRating: profile?.sellerRating ?? null,
          sellerRatingCount: profile?.sellerRatingCount ?? 0,
          buyerRating: profile?.buyerRating ?? null,
          buyerRatingCount: profile?.buyerRatingCount ?? 0,
          socialCreditScore: profile?.socialCreditScore ?? 0,
        };
      }),
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
    if (!sellerId || !sellerName) {
      return Response.json({ error: "Category, area, and seller identity are required." }, { status: 400 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = parseListingWrite(payload);
    if (!parsed.ok) return parsed.response;
    const {
      title,
      description,
      category,
      locationLabel,
      priceCents,
      condition,
      format,
      delivery,
      imageManifest,
      shippingPackage,
      endingAt,
    } = parsed;
    const storedDescription = attachPackageToDescription(description, shippingPackage);

    const db = await getDb();
    await persistFacebookProfileLink(sellerId, sellerName);
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, sellerId))
      .limit(1);
    const storedSocialProofs = parseSocialAccountsJson(
      existingProfile?.socialAccountsJson,
    );
    const checkedSocialProofs = storedSocialProofs.length
      ? await checkSocialAccounts(storedSocialProofs)
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
    const [facebookSellerIds, paypalSellerIds] = await Promise.all([
      connectedProviderUserIds(db, "facebook", [sellerId]),
      connectedProviderUserIds(db, "paypal", [sellerId]),
    ]);

    const id = crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    const socialAccountsJson = existingProfile?.socialAccountsJson ?? "[]";
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
          updatedAt,
        },
      });

    const [listing] = await db
      .insert(listings)
      .values({
        id,
        title,
        description: storedDescription,
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
        endingAt,
      })
      .returning();

    const unpacked = stripPackageFromDescription(listing.description);
    return Response.json(
      {
        listing: {
          ...listing,
          description: unpacked.description,
          shippingPackage: unpacked.package,
          socialProofsJson: publicSocialProofsJson(
            socialAccountsJson,
            facebookSellerIds.has(sellerId),
            sellerName,
          ),
          paymentDestinations: publicPaymentDestinations(
            existingProfile?.paymentDestinationsJson,
            paypalSellerIds.has(sellerId),
          ),
          paypalLinked: paypalSellerIds.has(sellerId),
          itemsSold: 0,
          sellerRating: null,
          sellerRatingCount: 0,
          buyerRating: null,
          buyerRatingCount: 0,
          socialCreditScore: existingProfile?.socialCreditScore ?? 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return registryError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getMarketplaceSession(request);
    if (!session) {
      return Response.json(
        { error: "Log in to edit this listing." },
        { status: 401 },
      );
    }

    const sellerId = session.user.id;
    const sellerName = session.user.name;
    const payload = (await request.json()) as Record<string, unknown>;
    const listingId =
      typeof payload.id === "string" ? payload.id.trim().slice(0, 80) : "";
    if (!listingId) {
      return Response.json({ error: "A listing id is required." }, { status: 400 });
    }

    const parsed = parseListingWrite(payload);
    if (!parsed.ok) return parsed.response;
    const {
      title,
      description,
      category,
      locationLabel,
      priceCents,
      condition,
      format,
      delivery,
      imageManifest,
      shippingPackage,
      endingAt,
    } = parsed;
    const storedDescription = attachPackageToDescription(description, shippingPackage);

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "Listing not found." }, { status: 404 });
    }
    if (existing.sellerId !== sellerId) {
      return Response.json({ error: "Only the listing owner can edit this item." }, { status: 403 });
    }

    await persistFacebookProfileLink(sellerId, sellerName);
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, sellerId))
      .limit(1);
    const storedSocialProofs = parseSocialAccountsJson(
      existingProfile?.socialAccountsJson,
    );
    const checkedSocialProofs = storedSocialProofs.length
      ? await checkSocialAccounts(storedSocialProofs)
      : [];
    const brokenAccount = checkedSocialProofs.find(
      (account) => account.health === "dead" || account.health === "invalid",
    );
    if (brokenAccount) {
      return Response.json(
        {
          error: "Fix or remove the unavailable social profile before saving.",
          account: brokenAccount,
        },
        { status: 422 },
      );
    }
    const [facebookSellerIds, paypalSellerIds] = await Promise.all([
      connectedProviderUserIds(db, "facebook", [sellerId]),
      connectedProviderUserIds(db, "paypal", [sellerId]),
    ]);

    const updatedAt = new Date().toISOString();
    const [listing] = await db
      .update(listings)
      .set({
        title,
        description: storedDescription,
        priceCents,
        condition,
        category,
        locationLabel,
        format,
        delivery,
        sellerName,
        socialProofsJson: JSON.stringify(checkedSocialProofs),
        imageManifestJson: JSON.stringify(imageManifest),
        endingAt,
        updatedAt,
      })
      .where(and(eq(listings.id, listingId), eq(listings.sellerId, sellerId)))
      .returning();
    if (!listing) {
      return Response.json({ error: "Listing not found." }, { status: 404 });
    }

    const unpacked = stripPackageFromDescription(listing.description);
    return Response.json({
      listing: {
        ...listing,
        description: unpacked.description,
        shippingPackage: unpacked.package,
        socialProofsJson: publicSocialProofsJson(
          existingProfile?.socialAccountsJson,
          facebookSellerIds.has(sellerId),
          sellerName,
        ),
        paymentDestinations: publicPaymentDestinations(
          existingProfile?.paymentDestinationsJson,
          paypalSellerIds.has(sellerId),
        ),
        paypalLinked: paypalSellerIds.has(sellerId),
        itemsSold: existingProfile?.itemsSold ?? 0,
        sellerRating: existingProfile?.sellerRating ?? null,
        sellerRatingCount: existingProfile?.sellerRatingCount ?? 0,
        buyerRating: existingProfile?.buyerRating ?? null,
        buyerRatingCount: existingProfile?.buyerRatingCount ?? 0,
        socialCreditScore: existingProfile?.socialCreditScore ?? 0,
      },
    });
  } catch (error) {
    return registryError(error);
  }
}
