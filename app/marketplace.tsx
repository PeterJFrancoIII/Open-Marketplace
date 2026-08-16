"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authClient } from "../lib/auth-client";
import { getLocalMediaUrl, storeMedia } from "../lib/media-store";
import { paymentLinksFor } from "../lib/payment-links";
import { parsePaymentDestinationsJson } from "../lib/payment-destinations";
import {
  parcelMonkeyCalculatorUrl,
  pirateShipCalculatorUrl,
} from "../lib/shipping-package";
import type { Listing, SocialProof } from "../lib/types";

const categories = [
  "All",
  "Furniture",
  "Electronics",
  "Vehicles",
  "Sporting goods",
  "Music",
  "Home",
  "Tools",
  "Collectibles",
];

const categoryVisuals: Record<string, { glyph: string; tone: string }> = {
  Furniture: { glyph: "FR", tone: "amber" },
  Electronics: { glyph: "EL", tone: "sky" },
  Vehicles: { glyph: "VE", tone: "slate" },
  "Sporting goods": { glyph: "SP", tone: "sage" },
  Music: { glyph: "MU", tone: "violet" },
  Home: { glyph: "HM", tone: "rose" },
  Tools: { glyph: "TL", tone: "coral" },
  Collectibles: { glyph: "CO", tone: "mint" },
};

const demoListings: Listing[] = [
  {
    id: "demo-record-console",
    title: "Walnut record console, restored",
    description:
      "Solid walnut cabinet with sliding doors and a ventilated component shelf. Restored by hand; a few honest age marks remain.",
    priceCents: 42000,
    currency: "USD",
    condition: "Good",
    category: "Furniture",
    locationLabel: "Brooklyn, NY",
    distanceMiles: 4.2,
    format: "Fixed price",
    delivery: "Pickup",
    sellerId: "demo-mina",
    sellerName: "Mina R.",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "facebook", url: "https://facebook.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-05T13:30:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-bike",
    title: "Steel commuter bike · 54 cm",
    description:
      "Fresh chain and brake pads, eight-speed drivetrain, puncture-resistant tires, and a rear rack. Ready for a daily commute.",
    priceCents: 67500,
    currency: "USD",
    condition: "Like new",
    category: "Sporting goods",
    locationLabel: "Astoria, NY",
    distanceMiles: 8.1,
    format: "Fixed price",
    delivery: "Pickup",
    sellerId: "demo-jon",
    sellerName: "Jon Bell",
    socialProofs: [
      { provider: "tiktok", url: "https://tiktok.com" },
      { provider: "instagram", url: "https://instagram.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-05T11:10:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-camera",
    title: "Mirrorless camera + 35 mm lens",
    description:
      "Compact full-frame body with low shutter count, prime lens, two batteries, charger, strap, and the original boxes.",
    priceCents: 89000,
    currency: "USD",
    condition: "Like new",
    category: "Electronics",
    locationLabel: "SoHo, NY",
    distanceMiles: 2.7,
    format: "Auction",
    delivery: "Both",
    sellerId: "demo-lena",
    sellerName: "Lena K.",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "facebook", url: "https://facebook.com" },
      { provider: "tiktok", url: "https://tiktok.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-04T20:40:00.000Z",
    endingAt: "2026-08-06T20:40:00.000Z",
    source: "demo",
  },
  {
    id: "demo-chair",
    title: "Adjustable drafting chair",
    description:
      "Comfortable high-seat task chair with a foot ring, breathable back, and clean upholstery. All adjustments work smoothly.",
    priceCents: 16000,
    currency: "USD",
    condition: "Good",
    category: "Home",
    locationLabel: "Hoboken, NJ",
    distanceMiles: 5.5,
    format: "Fixed price",
    delivery: "Pickup",
    sellerId: "demo-caro",
    sellerName: "Caro S.",
    socialProofs: [{ provider: "facebook", url: "https://facebook.com" }],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-04T17:25:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-synth",
    title: "Analog poly synth, 8 voice",
    description:
      "Excellent studio synth with original power supply and a padded soft case. Pots and keys are clean, no crackle or drift.",
    priceCents: 72000,
    currency: "USD",
    condition: "Good",
    category: "Music",
    locationLabel: "Greenpoint, NY",
    distanceMiles: 5.8,
    format: "Auction",
    delivery: "Both",
    sellerId: "demo-noah",
    sellerName: "Noah D.",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "tiktok", url: "https://tiktok.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-04T14:00:00.000Z",
    endingAt: "2026-08-07T16:00:00.000Z",
    source: "demo",
  },
  {
    id: "demo-camping",
    title: "Two-person camping kit",
    description:
      "Lightweight tent, two sleeping pads, compact stove, and cook set. Used for one weekend and stored dry.",
    priceCents: 21000,
    currency: "USD",
    condition: "Like new",
    category: "Sporting goods",
    locationLabel: "Jersey City, NJ",
    distanceMiles: 6.4,
    format: "Fixed price",
    delivery: "Both",
    sellerId: "demo-marcus",
    sellerName: "Marcus W.",
    socialProofs: [{ provider: "instagram", url: "https://instagram.com" }],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-03T18:40:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-trailer",
    title: "5 × 8 utility trailer",
    description:
      "Road-ready utility trailer with treated deck, mesh ramp, working lights, and clean registration paperwork.",
    priceCents: 185000,
    currency: "USD",
    condition: "Good",
    category: "Vehicles",
    locationLabel: "Newark, NJ",
    distanceMiles: 11.3,
    format: "Fixed price",
    delivery: "Pickup",
    sellerId: "demo-ray",
    sellerName: "Ray P.",
    socialProofs: [
      { provider: "facebook", url: "https://facebook.com" },
      { provider: "tiktok", url: "https://tiktok.com" },
    ],
    imageManifest: [],
    mediaAvailability: "offline",
    createdAt: "2026-08-03T13:20:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-press",
    title: "Tabletop screen-printing press",
    description:
      "Four-color, one-station press with micro-registration. Includes platens, squeegees, and a starter stack of clean screens.",
    priceCents: 34000,
    currency: "USD",
    condition: "Good",
    category: "Tools",
    locationLabel: "Bushwick, NY",
    distanceMiles: 5.1,
    format: "Fixed price",
    delivery: "Pickup",
    sellerId: "demo-avi",
    sellerName: "Avi T.",
    socialProofs: [{ provider: "instagram", url: "https://instagram.com" }],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-02T19:15:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-espresso",
    title: "Prosumer espresso machine",
    description:
      "PID-controlled single boiler machine with bottomless portafilter, precision basket, and recent gasket service.",
    priceCents: 47500,
    currency: "USD",
    condition: "Good",
    category: "Home",
    locationLabel: "Park Slope, NY",
    distanceMiles: 4.7,
    format: "Auction",
    delivery: "Both",
    sellerId: "demo-ana",
    sellerName: "Ana M.",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "facebook", url: "https://facebook.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-02T12:30:00.000Z",
    endingAt: "2026-08-06T14:00:00.000Z",
    source: "demo",
  },
  {
    id: "demo-film-camera",
    title: "35 mm rangefinder camera",
    description:
      "Mechanical rangefinder with a bright viewfinder and accurate meter. Includes a 40 mm lens, case, and fresh seals.",
    priceCents: 19500,
    currency: "USD",
    condition: "Fair",
    category: "Collectibles",
    locationLabel: "Lower East Side, NY",
    distanceMiles: 2.2,
    format: "Auction",
    delivery: "Shipping",
    sellerId: "demo-dev",
    sellerName: "Devon H.",
    socialProofs: [{ provider: "tiktok", url: "https://tiktok.com" }],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-08-01T16:45:00.000Z",
    endingAt: "2026-08-05T22:00:00.000Z",
    source: "demo",
  },
  {
    id: "demo-table",
    title: "Handmade ash dining table",
    description:
      "Six-seat solid ash table with wedged through-tenons and a durable soap finish. Built locally; delivery can be arranged.",
    priceCents: 120000,
    currency: "USD",
    condition: "New",
    category: "Furniture",
    locationLabel: "Red Hook, NY",
    distanceMiles: 6.1,
    format: "Fixed price",
    delivery: "Both",
    sellerId: "demo-ellis",
    sellerName: "Ellis Works",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "facebook", url: "https://facebook.com" },
    ],
    imageManifest: [],
    mediaAvailability: "online",
    createdAt: "2026-07-31T10:00:00.000Z",
    endingAt: null,
    source: "demo",
  },
  {
    id: "demo-dj",
    title: "Four-channel DJ controller",
    description:
      "Full-size jog wheels, balanced outputs, and a sturdy flight case. Firmware is current and every input has been tested.",
    priceCents: 38000,
    currency: "USD",
    condition: "Good",
    category: "Electronics",
    locationLabel: "Williamsburg, NY",
    distanceMiles: 3.9,
    format: "Fixed price",
    delivery: "Both",
    sellerId: "demo-sam",
    sellerName: "Sam O.",
    socialProofs: [
      { provider: "instagram", url: "https://instagram.com" },
      { provider: "tiktok", url: "https://tiktok.com" },
    ],
    imageManifest: [],
    mediaAvailability: "offline",
    createdAt: "2026-07-30T21:10:00.000Z",
    endingAt: null,
    source: "demo",
  },
];

type RegistryRow = Partial<Listing> & {
  socialProofsJson?: string;
  imageManifestJson?: string;
  paymentDestinationsJson?: string;
  distanceMiles?: number | string | null;
  priceCents?: number | string;
};

type ModalName = "create" | "donate" | "detail" | null;

type SocialDraft = {
  provider: "facebook" | "instagram" | "tiktok";
  url: string;
  accountCreatedAt: string;
  connectionCount: string;
  health?: SocialProof["health"];
  healthMessage?: string;
};

const emptySocialDrafts: SocialDraft[] = [
  { provider: "facebook", url: "", accountCreatedAt: "", connectionCount: "" },
  { provider: "instagram", url: "", accountCreatedAt: "", connectionCount: "" },
  { provider: "tiktok", url: "", accountCreatedAt: "", connectionCount: "" },
];

function draftsFromSocialProofs(accounts: SocialProof[]): SocialDraft[] {
  return emptySocialDrafts.map((draft) => {
    const saved = accounts.find((account) => account.provider === draft.provider);
    if (!saved?.url) return { ...draft };
    return {
      ...draft,
      url: saved.url,
      accountCreatedAt: saved.accountCreatedAt ?? "",
      connectionCount:
        saved.connectionCount == null ? "" : String(saved.connectionCount),
    };
  });
}

const demoReputation: Record<
  string,
  Pick<
    Listing,
    | "itemsSold"
    | "sellerRating"
    | "sellerRatingCount"
    | "buyerRating"
    | "buyerRatingCount"
  >
> = {
  "demo-mina": { itemsSold: 67, sellerRating: 4.9, sellerRatingCount: 52, buyerRating: 4.8, buyerRatingCount: 14 },
  "demo-jon": { itemsSold: 31, sellerRating: 4.8, sellerRatingCount: 25, buyerRating: 5, buyerRatingCount: 9 },
  "demo-lena": { itemsSold: 104, sellerRating: 5, sellerRatingCount: 88, buyerRating: 4.9, buyerRatingCount: 22 },
  "demo-caro": { itemsSold: 18, sellerRating: 4.7, sellerRatingCount: 15, buyerRating: 4.9, buyerRatingCount: 17 },
  "demo-noah": { itemsSold: 43, sellerRating: 4.9, sellerRatingCount: 39, buyerRating: 4.8, buyerRatingCount: 11 },
  "demo-marcus": { itemsSold: 12, sellerRating: 5, sellerRatingCount: 10, buyerRating: 5, buyerRatingCount: 6 },
  "demo-ray": { itemsSold: 26, sellerRating: 4.6, sellerRatingCount: 19, buyerRating: 4.8, buyerRatingCount: 7 },
  "demo-avi": { itemsSold: 58, sellerRating: 4.9, sellerRatingCount: 46, buyerRating: 4.7, buyerRatingCount: 8 },
  "demo-ana": { itemsSold: 39, sellerRating: 4.8, sellerRatingCount: 31, buyerRating: 4.9, buyerRatingCount: 13 },
  "demo-dev": { itemsSold: 21, sellerRating: 4.7, sellerRatingCount: 17, buyerRating: 4.8, buyerRatingCount: 12 },
  "demo-ellis": { itemsSold: 86, sellerRating: 5, sellerRatingCount: 72, buyerRating: 5, buyerRatingCount: 5 },
  "demo-sam": { itemsSold: 49, sellerRating: 4.8, sellerRatingCount: 41, buyerRating: 4.9, buyerRatingCount: 18 },
};

const restrictedTerms = [
  "firearm",
  "ammunition",
  "explosive",
  "silencer",
  "controlled substance",
];

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function normalizeRegistryListing(row: RegistryRow): Listing {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: String(row.title ?? "Untitled listing"),
    description: String(row.description ?? ""),
    priceCents: Number(row.priceCents ?? 0),
    currency: String(row.currency ?? "USD"),
    condition: (row.condition ?? "Good") as Listing["condition"],
    category: String(row.category ?? "Collectibles"),
    locationLabel: String(row.locationLabel ?? "Location shared after contact"),
    distanceMiles:
      row.distanceMiles === null || row.distanceMiles === undefined
        ? null
        : Number(row.distanceMiles),
    format: (row.format ?? "Fixed price") as Listing["format"],
    delivery: (row.delivery ?? "Pickup") as Listing["delivery"],
    sellerId: String(row.sellerId ?? "unknown"),
    sellerName: String(row.sellerName ?? "Community seller"),
    itemsSold: Number(row.itemsSold ?? 0),
    sellerRating:
      row.sellerRating === null || row.sellerRating === undefined
        ? undefined
        : Number(row.sellerRating),
    sellerRatingCount: Number(row.sellerRatingCount ?? 0),
    buyerRating:
      row.buyerRating === null || row.buyerRating === undefined
        ? undefined
        : Number(row.buyerRating),
    buyerRatingCount: Number(row.buyerRatingCount ?? 0),
    socialProofs: parseJsonArray<SocialProof>(
      row.socialProofs ?? row.socialProofsJson,
    ),
    imageManifest: parseJsonArray<Listing["imageManifest"][number]>(
      row.imageManifest ?? row.imageManifestJson,
    ),
    paymentDestinations:
      row.paymentDestinations ??
      parsePaymentDestinationsJson(row.paymentDestinationsJson),
    shippingPackage: row.shippingPackage ?? null,
    mediaAvailability: "offline",
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    endingAt: row.endingAt ? String(row.endingAt) : null,
    source: "registry",
  };
}

function formatPrice(listing: Listing): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency,
    maximumFractionDigits: 0,
  }).format(listing.priceCents / 100);
}

function relativeTime(iso: string): string {
  const difference = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.round(difference / 3_600_000));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function getDeviceId(): string {
  const key = "open-exchange-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = `device:${crypto.randomUUID()}`;
  window.localStorage.setItem(key, id);
  return id;
}

function socialLabel(provider: SocialProof["provider"]): string {
  if (provider === "instagram") return "ig";
  if (provider === "facebook") return "fb";
  if (provider === "tiktok") return "tt";
  return "id";
}

function reputationFor(listing: Listing) {
  const demo = demoReputation[listing.sellerId];
  return {
    itemsSold: listing.itemsSold ?? demo?.itemsSold ?? 0,
    sellerRating: listing.sellerRating ?? demo?.sellerRating,
    sellerRatingCount: listing.sellerRatingCount ?? demo?.sellerRatingCount ?? 0,
    buyerRating: listing.buyerRating ?? demo?.buyerRating,
    buyerRatingCount: listing.buyerRatingCount ?? demo?.buyerRatingCount ?? 0,
  };
}

function socialAccountsFor(listing: Listing): SocialProof[] {
  return listing.socialProofs.map((account, index) => {
    if (account.accountCreatedAt && account.connectionCount !== undefined) return account;
    const minimumYear = account.provider === "facebook" ? 2005 : account.provider === "instagram" ? 2011 : 2017;
    const year = minimumYear + ((listing.sellerId.length + index) % (2025 - minimumYear));
    const compactHandle = listing.sellerName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);
    return {
      ...account,
      handle: account.handle ?? compactHandle,
      accountCreatedAt: account.accountCreatedAt ?? `${year}-06-15`,
      connectionCount:
        account.connectionCount ?? 180 + ((listing.sellerId.length * 173 + index * 311) % 5400),
      connectionLabel: account.provider === "facebook" ? "friends" : "followers",
      metricsSource: "self-reported",
      health: listing.source === "demo" ? "active" : (account.health ?? "unknown"),
      lastCheckedAt: account.lastCheckedAt ?? "2026-08-05T19:45:00.000Z",
      healthMessage: account.healthMessage ?? "Profile URL resolves.",
    };
  });
}

function formatRating(rating: number | undefined, count: number) {
  return rating === undefined || count === 0 ? "Unrated" : `${rating.toFixed(1)} (${count})`;
}

function formatCompactCount(value: number | undefined) {
  if (value === undefined) return "Not supplied";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatAccountDate(value: string | undefined) {
  if (!value) return "Date not supplied";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function hasBrokenAccount(listing: Listing) {
  return socialAccountsFor(listing).some(
    (account) => account.health === "dead" || account.health === "invalid",
  );
}

function healthLabel(health: SocialProof["health"]) {
  if (health === "active") return "Live";
  if (health === "dead" || health === "invalid") return "Fix or remove";
  if (health === "checking") return "Checking";
  return "Recheck blocked";
}

function providerName(provider: SocialProof["provider"]) {
  if (provider === "tiktok") return "TikTok";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function usesShipping(delivery: string) {
  return delivery === "Shipping" || delivery === "Both";
}

function packageFromForm(formData: FormData) {
  return {
    weightLb: Number(formData.get("weightLb")),
    lengthIn: Number(formData.get("lengthIn")),
    widthIn: Number(formData.get("widthIn")),
    heightIn: Number(formData.get("heightIn")),
    originPostal: String(formData.get("originPostal") ?? ""),
    destPostal: String(formData.get("destPostal") ?? ""),
    originCountry: String(formData.get("originCountry") ?? "US"),
    destCountry: String(formData.get("destCountry") ?? "US"),
  };
}

function optionalPackageFromForm(formData: FormData) {
  const filled = ["weightLb", "lengthIn", "widthIn", "heightIn", "originPostal", "destPostal"]
    .some((key) => String(formData.get(key) ?? "").trim());
  return filled ? packageFromForm(formData) : null;
}

export default function Marketplace() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [listings, setListings] = useState<Listing[]>(demoListings);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [condition, setCondition] = useState("Any");
  const [format, setFormat] = useState("Any");
  const [delivery, setDelivery] = useState("Any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("best");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [localMedia, setLocalMedia] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>(
    emptySocialDrafts.map((account) => ({ ...account })),
  );
  const [profileSocialDrafts, setProfileSocialDrafts] = useState<SocialDraft[]>(
    emptySocialDrafts.map((account) => ({ ...account })),
  );
  const [composeOpened, setComposeOpened] = useState(false);
  const [composeDelivery, setComposeDelivery] = useState("Pickup");
  const [shippingQuotes, setShippingQuotes] = useState<
    { carrier: string; serviceName: string; description: string; totalPrice: string }[]
  >([]);
  const [shippingQuoteMessage, setShippingQuoteMessage] = useState("");
  const [quoting, setQuoting] = useState(false);

  const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL ?? "";
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    if (!signedIn || composeOpened || modal === "create") return;
    if (new URLSearchParams(window.location.search).get("compose") !== "1") return;

    const frame = window.requestAnimationFrame(() => {
      setComposeOpened(true);
      setModal("create");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [composeOpened, modal, signedIn]);

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/account/profile", {
        headers: { accept: "application/json" },
      });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as { socialAccounts?: SocialProof[] };
      const drafts = draftsFromSocialProofs(payload.socialAccounts ?? []);
      if (cancelled) return;
      setProfileSocialDrafts(drafts);
      setSocialDrafts(drafts.map((account) => ({ ...account })));
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const requestSocialHealth = useCallback(async (accounts: SocialProof[]) => {
    if (!accounts.length) return [];
    const response = await fetch("/api/social-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accounts }),
    });
    if (!response.ok) throw new Error("Social accounts could not be checked");
    const payload = (await response.json()) as { accounts?: SocialProof[] };
    return payload.accounts ?? [];
  }, []);

  const refreshSocialHealth = useCallback(async (targetListings: Listing[]) => {
    const eligible = targetListings
      .filter((listing) => listing.source === "registry" && listing.socialProofs.length)
      .slice(0, 16);
    const refreshed = await Promise.all(
      eligible.map(async (listing) => ({
        id: listing.id,
        accounts: await requestSocialHealth(listing.socialProofs).catch(
          () => listing.socialProofs,
        ),
      })),
    );
    const byId = new Map(refreshed.map((item) => [item.id, item.accounts]));
    setListings((current) =>
      current.map((listing) =>
        byId.has(listing.id)
          ? { ...listing, socialProofs: byId.get(listing.id) ?? listing.socialProofs }
          : listing,
      ),
    );
  }, [requestSocialHealth]);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        const response = await fetch("/api/listings?limit=80", {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { listings?: RegistryRow[] };
        if (!payload.listings?.length || cancelled) return;
        const registryListings = payload.listings.map(normalizeRegistryListing);
        setListings(registryListings);
        void refreshSocialHealth(registryListings);

        for (const listing of registryListings) {
          const firstAsset = listing.imageManifest[0];
          if (!firstAsset) continue;
          const url = await getLocalMediaUrl(firstAsset.hash).catch(() => null);
          if (url && !cancelled) {
            setLocalMedia((current) => ({ ...current, [listing.id]: url }));
            setListings((current) =>
              current.map((item) =>
                item.id === listing.id
                  ? { ...item, mediaAvailability: "local" }
                  : item,
              ),
            );
          }
        }
      } catch {
        // The static demo remains useful when the registry is unavailable locally.
      }
    }

    void loadRegistry();
    return () => {
      cancelled = true;
    };
  }, [refreshSocialHealth]);

  useEffect(() => {
    const overlayOpen = Boolean(modal || filtersOpen);
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modal, filtersOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minimum = minPrice ? Number(minPrice) * 100 : null;
    const maximum = maxPrice ? Number(maxPrice) * 100 : null;

    const result = listings.filter((listing) => {
      const searchable = `${listing.title} ${listing.description} ${listing.category} ${listing.locationLabel}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (category === "All" || listing.category === category) &&
        (condition === "Any" || listing.condition === condition) &&
        (format === "Any" || listing.format === format) &&
        (delivery === "Any" ||
          listing.delivery === delivery ||
          listing.delivery === "Both") &&
        (minimum === null || listing.priceCents >= minimum) &&
        (maximum === null || listing.priceCents <= maximum)
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "price-low") return a.priceCents - b.priceCents;
      if (sort === "price-high") return b.priceCents - a.priceCents;
      if (sort === "distance") {
        return (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999);
      }
      if (sort === "ending") {
        return (
          (a.endingAt ? new Date(a.endingAt).getTime() : Number.MAX_SAFE_INTEGER) -
          (b.endingAt ? new Date(b.endingAt).getTime() : Number.MAX_SAFE_INTEGER)
        );
      }
      if (query) {
        const aTitle = a.title.toLowerCase().includes(query) ? 1 : 0;
        const bTitle = b.title.toLowerCase().includes(query) ? 1 : 0;
        if (aTitle !== bTitle) return bTitle - aTitle;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    listings,
    search,
    category,
    condition,
    format,
    delivery,
    minPrice,
    maxPrice,
    sort,
  ]);

  const hasFilters =
    category !== "All" ||
    condition !== "Any" ||
    format !== "Any" ||
    delivery !== "Any" ||
    Boolean(minPrice || maxPrice);

  function resetFilters() {
    setCategory("All");
    setCondition("Any");
    setFormat("Any");
    setDelivery("Any");
    setMinPrice("");
    setMaxPrice("");
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openDetail(listing: Listing) {
    setSelectedListing(listing);
    setModal("detail");
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, listing: Listing) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail(listing);
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    setSelectedFiles(files);
    setFilePreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function updateSocialDraft(
    index: number,
    key: "url" | "accountCreatedAt" | "connectionCount",
    value: string,
  ) {
    setSocialDrafts((current) =>
      current.map((account, accountIndex) =>
        accountIndex === index
          ? { ...account, [key]: value, health: undefined, healthMessage: undefined }
          : account,
      ),
    );
  }

  function removeSocialDraft(index: number) {
    setSocialDrafts((current) =>
      current.map((account, accountIndex) =>
        accountIndex === index
          ? {
              ...account,
              url: "",
              accountCreatedAt: "",
              connectionCount: "",
              health: undefined,
              healthMessage: undefined,
            }
          : account,
      ),
    );
  }

  async function validateSocialDrafts() {
    const candidates = socialDrafts
      .filter((account) => account.url.trim())
      .map<SocialProof>((account) => ({
        provider: account.provider,
        url: account.url.trim(),
        accountCreatedAt: account.accountCreatedAt,
        connectionCount:
          account.connectionCount === "" ? undefined : Number(account.connectionCount),
        connectionLabel: account.provider === "facebook" ? "friends" : "followers",
        metricsSource: "self-reported",
        health: "checking",
      }));
    const checked = await requestSocialHealth(candidates);
    const byProvider = new Map(checked.map((account) => [account.provider, account]));
    setSocialDrafts((current) =>
      current.map((account) => {
        const result = byProvider.get(account.provider);
        return result
          ? {
              ...account,
              url: result.url,
              health: result.health,
              healthMessage: result.healthMessage,
            }
          : account;
      }),
    );
    return checked;
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const restrictedText = `${title} ${description}`.toLowerCase();
    if (restrictedTerms.some((term) => restrictedText.includes(term))) {
      setToast("This public starter does not accept restricted or unlawful items.");
      return;
    }

    setSubmitting(true);
    try {
      const socialProofs = await validateSocialDrafts();
      const brokenAccount = socialProofs.find(
        (account) => account.health === "dead" || account.health === "invalid",
      );
      if (brokenAccount) {
        setToast("Fix or remove the highlighted social link before publishing.");
        return;
      }

      const imageManifest = await storeMedia(selectedFiles);

      const payload = {
        title,
        description,
        priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
        currency: "USD",
        condition: String(formData.get("condition") ?? "Good"),
        category: String(formData.get("category") ?? "Collectibles"),
        locationLabel: String(formData.get("location") ?? "").trim(),
        distanceMiles: null,
        format: String(formData.get("format") ?? "Fixed price"),
        delivery: composeDelivery,
        shippingPackage: usesShipping(composeDelivery)
          ? optionalPackageFromForm(formData)
          : null,
        socialProofs,
        imageManifest,
        endingAt:
          String(formData.get("format")) === "Auction"
            ? new Date(Date.now() + 3 * 86_400_000).toISOString()
            : null,
      };

      let listing: Listing;
      try {
        const response = await fetch("/api/listings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as {
          listing?: RegistryRow;
          error?: string;
          account?: SocialProof;
        };
        if (response.status === 401) {
          setModal(null);
          setToast("Log in to publish this listing.");
          window.location.assign("/login?returnTo=/%3Fcompose%3D1");
          return;
        }
        if (response.status === 422) {
          if (result.account) {
            setSocialDrafts((current) =>
              current.map((account) =>
                account.provider === result.account?.provider
                  ? {
                      ...account,
                      health: result.account.health,
                      healthMessage: result.account.healthMessage,
                    }
                  : account,
              ),
            );
          }
          setToast(result.error ?? "Fix or remove the unavailable social link.");
          return;
        }
        if (!response.ok || !result.listing) throw new Error("Registry write failed");
        listing = normalizeRegistryListing(result.listing);
        listing.mediaAvailability = imageManifest.length ? "local" : "offline";
      } catch {
        listing = {
          ...payload,
          sellerId: session?.user.id ?? getDeviceId(),
          sellerName: session?.user.name ?? "Community seller",
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          source: "device",
          mediaAvailability: imageManifest.length ? "local" : "offline",
        } as Listing;
      }

      setListings((current) => [listing, ...current]);
      if (filePreviews[0]) {
        setLocalMedia((current) => ({ ...current, [listing.id]: filePreviews[0] }));
      }
      setSelectedFiles([]);
      setFilePreviews([]);
      setSocialDrafts(profileSocialDrafts.map((account) => ({ ...account })));
      setModal(null);
      setToast(
        listing.source === "registry"
          ? "Listing published. Image bytes remain on this device."
          : "Saved on this device; the registry is not connected in this preview.",
      );
    } catch {
      setToast("The listing could not be saved on this device.");
    } finally {
      setSubmitting(false);
    }
  }

  async function recheckListingSocial(listing: Listing) {
    if (listing.source === "demo") {
      setToast("Demo trust data is illustrative; real profiles are rechecked live.");
      return;
    }
    setToast("Rechecking social links…");
    const checked = await requestSocialHealth(listing.socialProofs).catch(() => null);
    if (!checked) {
      setToast("The social platforms did not allow a recheck right now.");
      return;
    }
    const updated = { ...listing, socialProofs: checked };
    setListings((current) =>
      current.map((item) => (item.id === listing.id ? updated : item)),
    );
    setSelectedListing(updated);
    setToast(
      checked.some((account) => account.health === "dead" || account.health === "invalid")
        ? "A dead link was found. The seller must fix or remove it."
        : "Social links rechecked.",
    );
  }

  async function requestShippingEstimates(form: HTMLFormElement) {
    if (quoting) return;
    setQuoting(true);
    setShippingQuotes([]);
    try {
      const formData = new FormData(form);
      const response = await fetch("/api/shipping/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          package: packageFromForm(formData),
          goodsValueUsd: Number(formData.get("price") ?? 0),
        }),
      });
      const result = (await response.json()) as {
        quotes?: { carrier: string; serviceName: string; description: string; totalPrice: string }[];
        message?: string;
        error?: string;
        pirateShipUrl?: string;
        parcelMonkeyCalculatorUrl?: string;
      };
      if (response.status === 401) {
        setToast("Log in to request shipping estimates.");
        return;
      }
      if (!response.ok) {
        setShippingQuoteMessage(result.error ?? "Estimates are unavailable. Use the official calculators.");
        return;
      }
      setShippingQuotes(result.quotes ?? []);
      setShippingQuoteMessage(
        result.message ??
          "Use the official calculators if live quotes are not configured.",
      );
    } catch {
      setShippingQuoteMessage("Estimates are unavailable. Use the official calculators.");
    } finally {
      setQuoting(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copied.`);
    } catch {
      setToast("Copy is unavailable in this browser.");
    }
  }

  async function shareListing(listing: Listing) {
    const shareText = `${listing.title} — ${formatPrice(listing)} on Open Marketplace`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setToast("Listing summary copied.");
      }
    } catch {
      // Closing the native share sheet is not an error worth surfacing.
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Open Marketplace home">
          <span className="wordmark-mark">↔</span>
          <span className="wordmark-copy">open marketplace</span>
        </a>

        <label className="search-wrap">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search furniture, cameras, bikes…"
            aria-label="Search listings"
          />
        </label>

        <div className="top-actions">
          <button
            className="button button-ghost desktop-action"
            onClick={() => setModal("donate")}
          >
            Fund it
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              if (sessionPending) return;
              if (!signedIn) {
                window.location.assign("/login?returnTo=/%3Fcompose%3D1");
                return;
              }
              setModal("create");
            }}
          >
            <span aria-hidden="true">＋</span>
            <span className="desktop-action">List an item</span>
            <span className="mobile-label">List</span>
          </button>
          <a
            className="button button-login"
            href={signedIn ? "/account" : "/login"}
          >
            <span aria-hidden="true">{signedIn ? "●" : "↗"}</span>
            {signedIn ? "My account" : "Log in"}
          </a>
        </div>
      </header>

      <nav className="category-bar" aria-label="Listing categories">
        {categories.map((item) => (
          <button
            className={`chip ${category === item ? "active" : ""}`}
            key={item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="market-layout" id="top">
        <aside className={`filters ${filtersOpen ? "open" : ""}`} aria-label="Listing filters">
          <div className="filter-group">
            <div className="filter-heading">
              <span>Filters</span>
              {hasFilters && (
                <button className="filter-reset" onClick={resetFilters}>Clear all</button>
              )}
            </div>
            <div className="range-row">
              <input
                inputMode="numeric"
                min="0"
                placeholder="Min $"
                type="number"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                aria-label="Minimum price"
              />
              <input
                inputMode="numeric"
                min="0"
                placeholder="Max $"
                type="number"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                aria-label="Maximum price"
              />
            </div>
          </div>

          <FilterChoices
            title="Condition"
            options={["Any", "New", "Like new", "Good", "Fair"]}
            value={condition}
            onChange={setCondition}
          />
          <FilterChoices
            title="Buying format"
            options={["Any", "Fixed price", "Auction"]}
            value={format}
            onChange={setFormat}
          />
          <FilterChoices
            title="Delivery"
            options={["Any", "Pickup", "Shipping"]}
            value={delivery}
            onChange={setDelivery}
          />

          <div className="filter-group">
            <div className="filter-heading">Trust signals</div>
            <label>
              <input type="checkbox" defaultChecked /> Social profile linked
            </label>
            <label>
              <input type="checkbox" /> Media available now
            </label>
          </div>

          <button
            className="button button-primary mobile-filter-button"
            onClick={() => setFiltersOpen(false)}
          >
            Show {filteredListings.length} results
          </button>
        </aside>

        <main className="main-content">
          <section className="principle-banner" aria-label="How trust data works">
            <span className="principle-icon" aria-hidden="true">#</span>
            <div>
              <strong>Trust facts travel with every listing.</strong>
              <p>Live social links, account age, connection counts, items sold, and buyer/seller ratings are always visible.</p>
            </div>
            <a
              className="banner-link"
              href="https://github.com/PeterJFrancoIII/Open-Marketplace"
              target="_blank"
              rel="noreferrer"
            >
              Open source by default ↗
            </a>
          </section>

          <header className="results-head">
            <div>
              <span className="eyebrow">Community listings</span>
              <h1>{search ? `Results for “${search}”` : "Fresh near you"}</h1>
              <p className="result-count">
                {filteredListings.length} items · New York area · radius 25 mi
              </p>
            </div>
            <div className="sort-wrap">
              <button
                className="button button-ghost mobile-filter-button"
                onClick={() => setFiltersOpen(true)}
              >
                Filters
              </button>
              <label htmlFor="sort">Sort</label>
              <select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="best">Best match</option>
                <option value="newest">Newly listed</option>
                <option value="ending">Ending soon</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="distance">Distance: nearest</option>
              </select>
            </div>
          </header>

          {hasFilters && (
            <div className="active-filters" aria-label="Active filters">
              {category !== "All" && <ActiveFilter label={category} onClear={() => setCategory("All")} />}
              {condition !== "Any" && <ActiveFilter label={condition} onClear={() => setCondition("Any")} />}
              {format !== "Any" && <ActiveFilter label={format} onClear={() => setFormat("Any")} />}
              {delivery !== "Any" && <ActiveFilter label={delivery} onClear={() => setDelivery("Any")} />}
              {(minPrice || maxPrice) && (
                <ActiveFilter
                  label={`$${minPrice || "0"}–$${maxPrice || "∞"}`}
                  onClear={() => {
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                />
              )}
            </div>
          )}

          <section className="listing-grid" aria-live="polite">
            {filteredListings.map((listing) => {
              const visual = categoryVisuals[listing.category] ?? { glyph: "OE", tone: "slate" };
              const saved = favorites.has(listing.id);
              const reputation = reputationFor(listing);
              const socialAccounts = socialAccountsFor(listing);
              return (
                <article
                  className="listing-card"
                  key={listing.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${listing.title}`}
                  onClick={() => openDetail(listing)}
                  onKeyDown={(event) => handleCardKey(event, listing)}
                >
                  <div className={`listing-media tone-${visual.tone}`}>
                    <span className="media-glyph" aria-hidden="true">{visual.glyph}</span>
                    {localMedia[listing.id] && (
                      // Native blob URLs are intentionally used; these bytes never hit a server.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="local-image" src={localMedia[listing.id]} alt="Seller-held listing media" />
                    )}
                    <span className="media-badge">
                      <span className="online-dot" />
                      {listing.mediaAvailability === "local"
                        ? "on this device"
                        : listing.mediaAvailability === "online"
                          ? "seller online"
                          : "request media"}
                    </span>
                    <button
                      className={`save-button ${saved ? "saved" : ""}`}
                      aria-label={saved ? "Remove saved listing" : "Save listing"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(listing.id);
                      }}
                    >
                      {saved ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="listing-info">
                    <div className="price-row">
                      <span className="price">{formatPrice(listing)}</span>
                      <span className="format-tag">{listing.format}</span>
                    </div>
                    <h2 className="listing-title">{listing.title}</h2>
                    <div className="listing-meta">
                      <span>{listing.locationLabel}</span>
                      <span className="meta-separator">·</span>
                      <span>{listing.distanceMiles ? `${listing.distanceMiles} mi` : relativeTime(listing.createdAt)}</span>
                    </div>
                    <div className="reputation-row" aria-label="Seller and buyer reputation">
                      <span>★ {formatRating(reputation.sellerRating, reputation.sellerRatingCount)} seller</span>
                      <span>★ {formatRating(reputation.buyerRating, reputation.buyerRatingCount)} buyer</span>
                      <span>{reputation.itemsSold} sold</span>
                    </div>
                    <div className="social-facts" aria-label={`${socialAccounts.length} linked social accounts`}>
                      {socialAccounts.length ? socialAccounts.map((account, index) => (
                        <a
                          className={`social-fact status-${account.health ?? "unknown"}`}
                          href={account.url}
                          target="_blank"
                          rel="noreferrer"
                          key={`${account.provider}-${index}`}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          title={account.healthMessage}
                        >
                          <span className="proof-mark">{socialLabel(account.provider)}</span>
                          <span className="social-fact-copy">
                            <strong>@{account.handle ?? providerName(account.provider)}</strong>
                            <small>
                              Joined {formatAccountDate(account.accountCreatedAt)} · {formatCompactCount(account.connectionCount)} {account.connectionLabel ?? "connections"}
                            </small>
                          </span>
                          <span className="link-health">{healthLabel(account.health)}</span>
                        </a>
                      )) : (
                        <span className="no-social">No social account supplied</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!filteredListings.length && (
              <div className="empty-state">
                <h2>No exact matches</h2>
                <p>Widen the price range or clear a filter.</p>
                <button className="button button-dark" onClick={resetFilters}>Reset filters</button>
              </div>
            )}
          </section>
        </main>
      </div>

      {filtersOpen && <button className="scrim" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}

      {modal && (
        <>
          <button className="scrim" aria-label="Close dialog" onClick={() => setModal(null)} />
          {modal === "create" && (
            <div className="modal modal-create" role="dialog" aria-modal="true" aria-labelledby="create-title">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">Publish metadata only</span>
                  <h2 id="create-title">List an item</h2>
                  <p>Your selected photos stay in this browser’s local media vault.</p>
                </div>
                <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
              </div>

              <form onSubmit={submitListing}>
                <div className="form-grid">
                  <div className="field field-full">
                    <label htmlFor="title">Title</label>
                    <input id="title" name="title" required maxLength={90} placeholder="What are you selling?" />
                  </div>
                  <div className="field">
                    <label htmlFor="price">Price</label>
                    <input id="price" name="price" required min="0" step="1" type="number" placeholder="$0" />
                  </div>
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select id="category" name="category" defaultValue="Furniture">
                      {categories.slice(1).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="condition">Condition</label>
                    <select id="condition" name="condition" defaultValue="Good">
                      {['New', 'Like new', 'Good', 'Fair'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="format">Format</label>
                    <select id="format" name="format" defaultValue="Fixed price">
                      <option>Fixed price</option>
                      <option>Auction</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="delivery">Fulfillment</label>
                    <select
                      id="delivery"
                      name="delivery"
                      value={composeDelivery}
                      onChange={(event) => {
                        setComposeDelivery(event.target.value);
                        setShippingQuotes([]);
                        setShippingQuoteMessage("");
                      }}
                    >
                      <option>Pickup</option>
                      <option>Shipping</option>
                      <option>Both</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="location">Area</label>
                    <input id="location" name="location" required placeholder="Brooklyn, NY" />
                  </div>
                  {usesShipping(composeDelivery) && (
                    <div className="field field-full">
                      <strong>Package for estimates</strong>
                      <p className="form-note">
                        Optional. Used for Parcel Monkey quotes and official calculator links. This is not a booking, and the marketplace does not ship the item.
                      </p>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="weightLb">Weight (lb)</label>
                          <input id="weightLb" name="weightLb" type="number" min="0.1" max="70" step="0.1" placeholder="2" />
                        </div>
                        <div className="field">
                          <label htmlFor="lengthIn">Length (in)</label>
                          <input id="lengthIn" name="lengthIn" type="number" min="1" max="80" step="0.1" placeholder="12" />
                        </div>
                        <div className="field">
                          <label htmlFor="widthIn">Width (in)</label>
                          <input id="widthIn" name="widthIn" type="number" min="1" max="80" step="0.1" placeholder="9" />
                        </div>
                        <div className="field">
                          <label htmlFor="heightIn">Height (in)</label>
                          <input id="heightIn" name="heightIn" type="number" min="1" max="80" step="0.1" placeholder="6" />
                        </div>
                        <div className="field">
                          <label htmlFor="originPostal">Origin postal</label>
                          <input id="originPostal" name="originPostal" placeholder="11215" />
                        </div>
                        <div className="field">
                          <label htmlFor="destPostal">Destination postal</label>
                          <input id="destPostal" name="destPostal" placeholder="10001" />
                        </div>
                        <div className="field">
                          <label htmlFor="originCountry">Origin country</label>
                          <input id="originCountry" name="originCountry" defaultValue="US" maxLength={2} />
                        </div>
                        <div className="field">
                          <label htmlFor="destCountry">Destination country</label>
                          <input id="destCountry" name="destCountry" defaultValue="US" maxLength={2} />
                        </div>
                      </div>
                      <div className="modal-actions">
                        <button
                          className="button button-ghost"
                          type="button"
                          disabled={quoting}
                          onClick={(event) => {
                            const form = event.currentTarget.form;
                            if (form) void requestShippingEstimates(form);
                          }}
                        >
                          {quoting ? "Getting estimates…" : "Get estimates"}
                        </button>
                        <a className="button button-ghost" href={pirateShipCalculatorUrl()} target="_blank" rel="noreferrer">
                          Pirate Ship calculator
                        </a>
                        <a className="button button-ghost" href={parcelMonkeyCalculatorUrl()} target="_blank" rel="noreferrer">
                          Parcel Monkey calculator
                        </a>
                      </div>
                      {shippingQuoteMessage && <p className="form-note">{shippingQuoteMessage}</p>}
                      {shippingQuotes.length > 0 && (
                        <div className="detail-social-list">
                          {shippingQuotes.map((quote) => (
                            <div className="detail-social-account" key={`${quote.carrier}-${quote.serviceName}-${quote.totalPrice}`}>
                              <strong>{quote.carrier} · {quote.serviceName}</strong>
                              <small>{quote.totalPrice} GBP{quote.description ? ` · ${quote.description}` : ""}</small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="field field-full">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" name="description" required maxLength={1400} placeholder="Condition, dimensions, pickup details…" />
                  </div>
                  <div className="field field-full">
                    <label>Photos held on this device</label>
                    <label className="upload-box">
                      <span className="upload-symbol" aria-hidden="true">⌁</span>
                      <span className="upload-copy">
                        <strong>Choose up to six images</strong>
                        <span>Hashed locally · never uploaded to the registry</span>
                      </span>
                      <input type="file" accept="image/*" multiple onChange={handleFiles} />
                    </label>
                    {filePreviews.length > 0 && (
                      <div className="preview-strip">
                        {filePreviews.map((url, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={`Local preview ${index + 1}`} key={url} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="field field-full">
                    <label htmlFor="sellerAccount">Seller account</label>
                    <input
                      id="sellerAccount"
                      value={session?.user.name ?? "Signed-in account"}
                      readOnly
                      aria-describedby="sellerAccountHelp"
                    />
                    <small id="sellerAccountHelp">
                      Listing ownership comes from your signed-in account.
                    </small>
                  </div>
                  <div className="field field-full social-editor">
                    <div className="social-editor-head">
                      <div>
                        <strong>Social trust profile</strong>
                        <span>Defaults come from your saved account settings. Links are checked live. Account dates and connection counts are public and self-reported.</span>
                      </div>
                      <span className="live-check-pill">↻ checked on publish</span>
                    </div>
                    {socialDrafts.map((account, index) => (
                      <div
                        className={`social-edit-row status-${account.health ?? "unchecked"}`}
                        key={account.provider}
                      >
                        <div className="social-edit-provider">
                          <span className="proof-mark">{socialLabel(account.provider)}</span>
                          <strong>{providerName(account.provider)}</strong>
                        </div>
                        <input
                          type="url"
                          placeholder={`https://${account.provider}.com/your-profile`}
                          value={account.url}
                          onChange={(event) => updateSocialDraft(index, "url", event.target.value)}
                          aria-label={`${providerName(account.provider)} profile URL`}
                        />
                        <label>
                          <span>Account created</span>
                          <input
                            type="date"
                            value={account.accountCreatedAt}
                            onChange={(event) => updateSocialDraft(index, "accountCreatedAt", event.target.value)}
                            disabled={!account.url}
                          />
                        </label>
                        <label>
                          <span>{account.provider === "facebook" ? "Friends" : "Followers"}</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={account.connectionCount}
                            onChange={(event) => updateSocialDraft(index, "connectionCount", event.target.value)}
                            disabled={!account.url}
                          />
                        </label>
                        <div className="social-edit-action">
                          {account.url && (
                            <button type="button" onClick={() => removeSocialDraft(index)}>Remove</button>
                          )}
                          {account.health && (
                            <span className="social-edit-status">{healthLabel(account.health)}</span>
                          )}
                        </div>
                        {account.healthMessage && (
                          <p className="social-edit-message">{account.healthMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="form-note">
                  Publishing confirms the item is lawful where offered. A dead or malformed social link blocks publication until you fix it or remove it. Connection counts and creation dates are self-reported until provider OAuth confirms them.
                </p>
                <div className="modal-actions">
                  <button className="button button-ghost" type="button" onClick={() => setModal(null)}>Cancel</button>
                  <button className="button button-primary" type="submit" disabled={submitting}>
                    {submitting ? "Publishing…" : "Publish listing"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {modal === "donate" && (
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="donate-title">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">No ads · no listing fees</span>
                  <h2 id="donate-title">Fund the commons</h2>
                  <p>Hosting, audits, and maintainers are paid by people who want the exchange to stay open.</p>
                </div>
                <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
              </div>
              <div className="donation-card">
                <span className="eyebrow">Suggested monthly support</span>
                <div className="big-number">$5</div>
                <p>Enough to cover thousands of metadata-only listing reads on a lightweight edge registry.</p>
                {donationUrl ? (
                  <a className="button button-primary" href={donationUrl} target="_blank" rel="noreferrer">Open donation page ↗</a>
                ) : (
                  <button className="button button-primary" onClick={() => setToast("Add NEXT_PUBLIC_DONATION_URL before launch.")}>Configure donations</button>
                )}
              </div>
            </div>
          )}

          {modal === "detail" && selectedListing && (
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="detail-title">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">{selectedListing.category} · {selectedListing.condition}</span>
                </div>
                <button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button>
              </div>
              <div className="detail-grid">
                <div className={`detail-media tone-${(categoryVisuals[selectedListing.category] ?? { tone: "slate" }).tone}`}>
                  <span className="media-glyph" aria-hidden="true">
                    {(categoryVisuals[selectedListing.category] ?? { glyph: "OE" }).glyph}
                  </span>
                  {localMedia[selectedListing.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="local-image" src={localMedia[selectedListing.id]} alt="Seller-held listing media" />
                  )}
                </div>
                <div className="detail-copy">
                  <span className="eyebrow">Listed {relativeTime(selectedListing.createdAt)}</span>
                  <h2 id="detail-title">{selectedListing.title}</h2>
                  <div className="detail-price">{formatPrice(selectedListing)}</div>
                  <p className="detail-description">{selectedListing.description}</p>
                  <div className="seller-card">
                    <strong>Listed by {selectedListing.sellerName}</strong>
                    <p>{selectedListing.locationLabel} · public trust record</p>
                    <div className="reputation-grid">
                      <div>
                        <span>Seller rating</span>
                        <strong>★ {formatRating(reputationFor(selectedListing).sellerRating, reputationFor(selectedListing).sellerRatingCount)}</strong>
                      </div>
                      <div>
                        <span>Buyer rating</span>
                        <strong>★ {formatRating(reputationFor(selectedListing).buyerRating, reputationFor(selectedListing).buyerRatingCount)}</strong>
                      </div>
                      <div>
                        <span>Items sold</span>
                        <strong>{reputationFor(selectedListing).itemsSold}</strong>
                      </div>
                    </div>
                    <div className="detail-social-list">
                      {socialAccountsFor(selectedListing).length ? socialAccountsFor(selectedListing).map((account, index) => (
                        <a
                          className={`detail-social-account status-${account.health ?? "unknown"}`}
                          href={account.url}
                          target="_blank"
                          rel="noreferrer"
                          key={`${account.provider}-${index}`}
                        >
                          <span className="proof-mark">{socialLabel(account.provider)}</span>
                          <span>
                            <strong>{providerName(account.provider)} · @{account.handle}</strong>
                            <small>
                              Created {formatAccountDate(account.accountCreatedAt)} · {formatCompactCount(account.connectionCount)} {account.connectionLabel ?? "connections"} · {account.metricsSource === "oauth" ? "provider verified" : "self-reported"}
                            </small>
                          </span>
                          <span className="link-health">{healthLabel(account.health)}</span>
                        </a>
                      )) : <span className="no-social">No social account supplied</span>}
                    </div>
                    <button
                      className="recheck-button"
                      onClick={() => void recheckListingSocial(selectedListing)}
                    >
                      ↻ Recheck account links now
                    </button>
                    {hasBrokenAccount(selectedListing) && (
                      <div className="broken-link-alert">
                        This seller profile has a dead link. Listing activity is blocked until the seller fixes or removes it.
                      </div>
                    )}
                    <div className="detail-social-list">
                      <strong>Pay the seller</strong>
                      <p className="form-note">
                        Public destinations only. The marketplace does not send, hold, escrow, convert, or protect this transfer.
                      </p>
                      {paymentLinksFor(selectedListing.paymentDestinations ?? []).length
                        ? paymentLinksFor(selectedListing.paymentDestinations ?? []).map((link) => (
                            link.href ? (
                              <a
                                className="detail-social-account"
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                key={link.rail}
                              >
                                <strong>{link.label}</strong>
                                <small>{link.destination}</small>
                                <span className="link-health">{link.actionLabel}</span>
                              </a>
                            ) : (
                              <button
                                className="detail-social-account"
                                type="button"
                                key={link.rail}
                                onClick={() => void copyText(link.destination, link.label)}
                              >
                                <strong>{link.label}</strong>
                                <small>{link.destination}</small>
                                <span className="link-health">{link.actionLabel}</span>
                              </button>
                            )
                          ))
                        : (
                          <span className="no-social">Seller has not published a public pay-to destination.</span>
                        )}
                    </div>
                    {usesShipping(selectedListing.delivery) && (
                      <div className="media-notice">
                        <strong>Shipping estimates</strong>
                        {selectedListing.shippingPackage ? (
                          <p>
                            {selectedListing.shippingPackage.weightLb} lb · {selectedListing.shippingPackage.lengthIn}×{selectedListing.shippingPackage.widthIn}×{selectedListing.shippingPackage.heightIn} in · {selectedListing.shippingPackage.originPostal} {selectedListing.shippingPackage.originCountry} → {selectedListing.shippingPackage.destPostal} {selectedListing.shippingPackage.destCountry}
                          </p>
                        ) : (
                          <p>Seller did not save a package size. Use the official calculators.</p>
                        )}
                        <p>
                          <a href={pirateShipCalculatorUrl()} target="_blank" rel="noreferrer">Pirate Ship calculator</a>
                          {" · "}
                          <a href={parcelMonkeyCalculatorUrl()} target="_blank" rel="noreferrer">Parcel Monkey calculator</a>
                        </p>
                        <p>Estimates are not a booking. The marketplace does not ship the item.</p>
                      </div>
                    )}
                  </div>
                  <div className="media-notice">
                    <strong>Seller-controlled media</strong>
                    <p>
                      {localMedia[selectedListing.id]
                        ? "This image was loaded from your device’s local vault."
                        : "The registry has no image bytes. A peer transfer is requested when the seller is online."}
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button className="button button-ghost" onClick={() => void shareListing(selectedListing)}>Share</button>
                    <button
                      className="button button-primary"
                      disabled={hasBrokenAccount(selectedListing)}
                      onClick={() => setToast("Contact transport is the next protocol adapter to connect.")}
                    >
                      {hasBrokenAccount(selectedListing) ? "Seller must repair profile" : "Contact seller"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function FilterChoices({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const groupName = title.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="filter-group">
      <div className="filter-heading">{title}</div>
      {options.map((option) => (
        <label className="radio-row" key={option}>
          <input
            type="radio"
            name={groupName}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button className="active-filter" onClick={onClear} aria-label={`Remove ${label} filter`}>
      {label} ×
    </button>
  );
}
