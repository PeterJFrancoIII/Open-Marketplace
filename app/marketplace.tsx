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
import {
  getLocalMediaUrl,
  localMediaKey,
  storeMedia,
  toRegistryMediaManifest,
} from "../lib/media-store";
import type { Listing, MediaManifest, SocialProof } from "../lib/types";
import { TrustCard } from "./components/TrustCard";
import {
  buildTrustCardFromListing,
  hasProviderConnected,
} from "../lib/trust/trust-card-model";

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
    imageManifest: parseJsonArray<Record<string, unknown>>(
      row.imageManifest ?? row.imageManifestJson,
    ).map((item): MediaManifest => {
      const contentHash =
        typeof item.contentHash === "string"
          ? item.contentHash
          : typeof item.hash === "string"
            ? String(item.hash).replace(/^sha256:/i, "")
            : "";
      return {
        hash: contentHash ? `sha256:${contentHash.replace(/^sha256:/i, "")}` : "",
        name: String(item.filename ?? item.name ?? "image"),
        size: Number(item.byteLength ?? item.size ?? 0),
        type: String(item.mimeType ?? item.type ?? "image/jpeg"),
      };
    }),
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

async function ensureServerSession(): Promise<string> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: { accept: "application/json" },
  });
  const payload = (await response.json()) as {
    profileId?: string;
    error?: string;
    message?: string;
  };
  if (!response.ok || !payload.profileId) {
    throw new Error(payload.message || payload.error || "Could not establish session");
  }
  window.localStorage.setItem("open-exchange-profile-id", payload.profileId);
  return payload.profileId;
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
  // Never fabricate dates, follower counts, health, or check times.
  // Demo fixtures must carry their own declared fields; registry rows show only stored evidence.
  return listing.socialProofs.map((account) => ({
    ...account,
    connectionLabel:
      account.connectionLabel ??
      (account.provider === "facebook" ? "friends" : "followers"),
    metricsSource: account.metricsSource ?? "self-reported",
    health: account.health ?? (listing.source === "demo" ? "active" : "unknown"),
  }));
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
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>(demoListings);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [condition, setCondition] = useState("Any");
  const [format, setFormat] = useState("Any");
  const [delivery, setDelivery] = useState("Any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("best");
  const [requireSocialProfile, setRequireSocialProfile] = useState(false);
  const [requireProviderConnected, setRequireProviderConnected] = useState(false);
  const [minCompletedSales, setMinCompletedSales] = useState("");
  const [requireMediaLocal, setRequireMediaLocal] = useState(false);
  const [sessionProfileId, setSessionProfileId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [localMedia, setLocalMedia] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [transparency, setTransparency] = useState<{
    disputes: { opened: number; resolved: number };
    appeals: { opened: number; upheld: number; denied: number };
    reviewReports: { opened: number; actioned: number };
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>(
    emptySocialDrafts.map((account) => ({ ...account })),
  );

  const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL ?? "";

  useEffect(() => {
    let cancelled = false;
    void ensureServerSession()
      .then((profileId) => {
        if (!cancelled) setSessionProfileId(profileId);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setToast(
            error instanceof Error
              ? error.message
              : "Server session unavailable — protected actions are disabled.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          const url = await getLocalMediaUrl(localMediaKey(firstAsset)).catch(
            () => null,
          );
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

  useEffect(() => {
    if (modal !== "donate") return;
    let cancelled = false;
    void fetch("/api/transparency")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          disputes: { opened: number; resolved: number };
          appeals: { opened: number; upheld: number; denied: number };
          reviewReports: { opened: number; actioned: number };
        };
      })
      .then((payload) => {
        if (!cancelled && payload) setTransparency(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [modal]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const oauthError = params.get("oauth_error");
    const provider = params.get("provider") ?? "facebook";
    const omitted = params.get("omitted");
    let message = "";
    if (oauth === "connected") {
      const omitNote = omitted
        ? ` Provider omitted: ${omitted.replace(/,/g, ", ")}.`
        : "";
      message = `${provider} connected. Metrics show provider source only when returned.${omitNote}`;
      params.delete("oauth");
      params.delete("provider");
      params.delete("omitted");
    } else if (oauthError) {
      message = `OAuth: ${oauthError}`;
      params.delete("oauth_error");
    } else {
      return;
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
    // Defer toast so the effect only syncs the URL (external system) synchronously.
    const timer = window.setTimeout(() => setToast(message), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minimum = minPrice ? Number(minPrice) * 100 : null;
    const maximum = maxPrice ? Number(maxPrice) * 100 : null;
    const minSales = minCompletedSales ? Number(minCompletedSales) : null;

    const result = listings.filter((listing) => {
      const searchable = `${listing.title} ${listing.description} ${listing.category} ${listing.locationLabel}`.toLowerCase();
      const trust = buildTrustCardFromListing({
        profileId: listing.sellerId,
        displayName: listing.sellerName,
        memberSince: listing.createdAt,
        itemsSold: reputationFor(listing).itemsSold,
        sellerRating: reputationFor(listing).sellerRating,
        sellerRatingCount: reputationFor(listing).sellerRatingCount,
        buyerRating: reputationFor(listing).buyerRating,
        buyerRatingCount: reputationFor(listing).buyerRatingCount,
        socialProofs: socialAccountsFor(listing),
        socialActionRequired: hasBrokenAccount(listing),
      });
      return (
        (!query || searchable.includes(query)) &&
        (category === "All" || listing.category === category) &&
        (condition === "Any" || listing.condition === condition) &&
        (format === "Any" || listing.format === format) &&
        (delivery === "Any" ||
          listing.delivery === delivery ||
          listing.delivery === "Both") &&
        (minimum === null || listing.priceCents >= minimum) &&
        (maximum === null || listing.priceCents <= maximum) &&
        (!requireSocialProfile || trust.social.length > 0) &&
        (!requireProviderConnected || hasProviderConnected(trust)) &&
        (minSales === null || Number.isNaN(minSales) || trust.seller.completedSales >= minSales) &&
        (!requireMediaLocal || Boolean(localMedia[listing.id]) || listing.mediaAvailability === "local")
      );
    });

    // Explicit trust filters only — never use social popularity as a default rank factor.
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
    requireSocialProfile,
    requireProviderConnected,
    minCompletedSales,
    requireMediaLocal,
    localMedia,
  ]);

  const hasFilters =
    category !== "All" ||
    condition !== "Any" ||
    format !== "Any" ||
    delivery !== "Any" ||
    Boolean(minPrice || maxPrice) ||
    requireSocialProfile ||
    requireProviderConnected ||
    requireMediaLocal ||
    Boolean(minCompletedSales);

  function resetFilters() {
    setCategory("All");
    setCondition("Any");
    setFormat("Any");
    setDelivery("Any");
    setMinPrice("");
    setMaxPrice("");
    setRequireSocialProfile(false);
    setRequireProviderConnected(false);
    setRequireMediaLocal(false);
    setMinCompletedSales("");
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

  async function connectProviderOAuth(provider: SocialDraft["provider"]) {
    if (provider !== "facebook") {
      setToast("Only Facebook OAuth is wired in PR 5. Instagram/TikTok adapters come next.");
      return;
    }
    setToast("Starting provider OAuth…");
    try {
      const profileId = sessionProfileId ?? (await ensureServerSession());
      setSessionProfileId(profileId);
      const response = await fetch(`/api/oauth/${provider}/begin`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: "/" }),
      });
      const payload = (await response.json()) as {
        authorizationUrl?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !payload.authorizationUrl) {
        setToast(payload.message || payload.error || "OAuth is not configured on this instance.");
        return;
      }
      // Local mock adapter: complete without leaving the app.
      if (payload.authorizationUrl.includes("oauth.mock.open-marketplace.local")) {
        const callback = new URL(`/api/oauth/${provider}/callback`, window.location.origin);
        callback.searchParams.set(
          "code",
          `mock:${profileId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`,
        );
        const stateMatch = new URL(payload.authorizationUrl).searchParams.get("state");
        if (!stateMatch) {
          setToast("Mock OAuth state missing.");
          return;
        }
        callback.searchParams.set("state", stateMatch);
        window.location.assign(callback.toString());
        return;
      }
      window.location.assign(payload.authorizationUrl);
    } catch {
      setToast("Could not start OAuth. Check provider credentials and encryption key.");
    }
  }

  async function disconnectProviderOAuth(provider: SocialDraft["provider"]) {
    if (provider !== "facebook") return;
    try {
      const response = await fetch(`/api/oauth/${provider}/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setToast(payload.message || payload.error || "Disconnect failed.");
        return;
      }
      setToast(`${provider} provider grant revoked. Link health is unchanged.`);
    } catch {
      setToast("Disconnect failed.");
    }
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

      const profileId = sessionProfileId ?? (await ensureServerSession());
      setSessionProfileId(profileId);
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
        delivery: String(formData.get("delivery") ?? "Pickup"),
        sellerName: String(formData.get("sellerName") ?? "Community seller").trim(),
        socialProofs,
        // Registry contract — local vault keeps {hash,name,size,type} bytes off D1.
        imageManifest: toRegistryMediaManifest(imageManifest),
        endingAt:
          String(formData.get("format")) === "Auction"
            ? new Date(Date.now() + 3 * 86_400_000).toISOString()
            : null,
      };

      let listing: Listing;
      try {
        const response = await fetch("/api/listings", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as {
          listing?: RegistryRow;
          error?: string;
          account?: SocialProof;
        };
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
          ...(payload as Omit<
            Listing,
            "id" | "createdAt" | "source" | "mediaAvailability"
          >),
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          source: "device",
          mediaAvailability: imageManifest.length ? "local" : "offline",
        };
      }

      setListings((current) => [listing, ...current]);
      if (filePreviews[0]) {
        setLocalMedia((current) => ({ ...current, [listing.id]: filePreviews[0] }));
      }
      setSelectedFiles([]);
      setFilePreviews([]);
      setSocialDrafts(emptySocialDrafts.map((account) => ({ ...account })));
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
          <img
            className="wordmark-logo"
            src="/open-marketplace-logo-256.png"
            alt="Open Marketplace"
            width={180}
            height={135}
          />
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
          <button className="button button-primary" onClick={() => setModal("create")}>
            <span aria-hidden="true">＋</span>
            <span className="desktop-action">List an item</span>
            <span className="mobile-label">List</span>
          </button>
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
            <div className="filter-heading">Trust filters</div>
            <p className="filter-hint">Optional evidence filters — never used as hidden ranking.</p>
            <label>
              <input
                type="checkbox"
                checked={requireSocialProfile}
                onChange={(event) => setRequireSocialProfile(event.target.checked)}
              />{" "}
              Social profile linked
            </label>
            <label>
              <input
                type="checkbox"
                checked={requireProviderConnected}
                onChange={(event) => setRequireProviderConnected(event.target.checked)}
              />{" "}
              Provider-connected social account
            </label>
            <label>
              <input
                type="checkbox"
                checked={requireMediaLocal}
                onChange={(event) => setRequireMediaLocal(event.target.checked)}
              />{" "}
              Media available on this device
            </label>
            <label className="filter-stack">
              Minimum completed sales
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Any"
                value={minCompletedSales}
                onChange={(event) => setMinCompletedSales(event.target.value)}
                aria-label="Minimum completed sales"
              />
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
          <section className="brand-hero" aria-label="Open Marketplace brand">
            <img
              className="brand-hero-logo"
              src="/open-marketplace-logo-800.png"
              alt="Open Marketplace — real people, real profiles, real trust"
              width={800}
              height={600}
            />
            <div className="brand-hero-copy">
              <h1>Open Marketplace</h1>
              <p className="trust-line">
                <span>Real people.</span> <span>Real profiles.</span>{" "}
                <span>Real trust.</span>
              </p>
              <p>Connect your world. Trade with confidence. Photos stay on sellers&apos; devices.</p>
            </div>
          </section>

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
              const trustModel = buildTrustCardFromListing({
                profileId: listing.sellerId,
                displayName: listing.sellerName,
                memberSince: listing.createdAt,
                itemsSold: reputationFor(listing).itemsSold,
                sellerRating: reputationFor(listing).sellerRating,
                sellerRatingCount: reputationFor(listing).sellerRatingCount,
                buyerRating: reputationFor(listing).buyerRating,
                buyerRatingCount: reputationFor(listing).buyerRatingCount,
                socialProofs: socialAccountsFor(listing),
                socialActionRequired: hasBrokenAccount(listing),
              });
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
                    <TrustCard
                      model={trustModel}
                      variant="compact"
                      isOwner={
                        sessionProfileId != null && listing.sellerId === sessionProfileId
                      }
                      onFixSocial={() =>
                        setToast("Open the listing details to recheck or replace dead social links.")
                      }
                    />
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
                    <select id="delivery" name="delivery" defaultValue="Pickup">
                      <option>Pickup</option>
                      <option>Shipping</option>
                      <option>Both</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="location">Area</label>
                    <input id="location" name="location" required placeholder="Brooklyn, NY" />
                  </div>
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
                    <label htmlFor="sellerName">Display name</label>
                    <input id="sellerName" name="sellerName" required placeholder="Your name or handle" />
                  </div>
                  <div className="field field-full social-editor">
                    <div className="social-editor-head">
                      <div>
                        <strong>Social trust profile</strong>
                        <span>Links are checked live. Account dates and connection counts are public.</span>
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
                          {account.provider === "facebook" && (
                            <>
                              <button
                                type="button"
                                className="oauth-connect"
                                onClick={() => void connectProviderOAuth(account.provider)}
                              >
                                Connect with Facebook
                              </button>
                              <button
                                type="button"
                                onClick={() => void disconnectProviderOAuth(account.provider)}
                              >
                                Disconnect OAuth
                              </button>
                            </>
                          )}
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
              {transparency && (
                <div className="transparency-card" aria-label="Public moderation transparency">
                  <strong>Transparency (aggregate only)</strong>
                  <p>
                    Disputes opened {transparency.disputes.opened} · resolved{" "}
                    {transparency.disputes.resolved}. Appeals {transparency.appeals.opened} (
                    {transparency.appeals.upheld} upheld / {transparency.appeals.denied} denied).
                    Review reports {transparency.reviewReports.opened} (
                    {transparency.reviewReports.actioned} actioned).
                  </p>
                  <p className="form-note">
                    Complainant identities and private statements are never published. Adverse
                    actions include an appeal path.
                  </p>
                </div>
              )}
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
                    <p>{selectedListing.locationLabel} · live trust evidence</p>
                    <TrustCard
                      model={buildTrustCardFromListing({
                        profileId: selectedListing.sellerId,
                        displayName: selectedListing.sellerName,
                        memberSince: selectedListing.createdAt,
                        itemsSold: reputationFor(selectedListing).itemsSold,
                        sellerRating: reputationFor(selectedListing).sellerRating,
                        sellerRatingCount: reputationFor(selectedListing).sellerRatingCount,
                        buyerRating: reputationFor(selectedListing).buyerRating,
                        buyerRatingCount: reputationFor(selectedListing).buyerRatingCount,
                        socialProofs: socialAccountsFor(selectedListing),
                        socialActionRequired: hasBrokenAccount(selectedListing),
                      })}
                      variant="full"
                      isOwner={
                        sessionProfileId != null &&
                        selectedListing.sellerId === sessionProfileId
                      }
                      onFixSocial={() => void recheckListingSocial(selectedListing)}
                    />
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
