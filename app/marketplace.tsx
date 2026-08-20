"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authClient } from "../lib/auth-client";
import {
  LISTING_PHOTO_LIMIT,
  PHOTO_DRAG_TYPE,
  appendPhotoFiles,
  applyInspectGestureScale,
  applyInspectPan,
  applyInspectWheel,
  clampPhotoIndex,
  collectPhotoUrlsInOrder,
  inspectTransform,
  listingPhotoCount,
  manifestsFromPhotoDrafts,
  movePhotoDraft,
  photoDragIndex,
  photoDraftsFromExisting,
  photoDraftsFromManifest,
  previewUrlsFromPhotoDrafts,
  removePhotoDraft,
  resetInspectView,
  revokePhotoDraft,
  stepInspectZoom,
  stepPhotoIndex,
  type PhotoDraft,
} from "../lib/listing-photos";
import { readMediaNodeConfig } from "../lib/media-node";
import { publicMediaOriginsFromManifests } from "../lib/image-manifest";
import { getLocalMediaUrl, pinListingMediaToHost, storeMedia } from "../lib/media-store";
import { fetchReplicaCatalog, publishReplicaSnapshot } from "../lib/replica-host";
import { paymentLinkFor, paymentLinksFor } from "../lib/payment-links";
import { parsePaymentDestinationsJson } from "../lib/payment-destinations";
import {
  parcelMonkeyCalculatorUrl,
  pirateShipCalculatorUrl,
} from "../lib/shipping-package";
import { isConnectedFacebookProof } from "../lib/facebook-listing-proof";
import { isLinkCheckFresh, listingLinksNeedCheck } from "../lib/link-health";
import {
  factsFromSocialProof,
  officialConnectorDisplay,
  officialConnectorLine,
  publicConnectorCatalog,
} from "../lib/official-connector-facts";
import { computeSocialCreditScore } from "../lib/social-credit";
import {
  connectedSocialCreditInput,
  socialConnectorById,
} from "../lib/social-connectors";
import type { Listing, PaymentDestination, SocialProof } from "../lib/types";

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

function demoSocial(
  sellerId: string,
  providers: Array<SocialProof["provider"]>,
): SocialProof[] {
  const handle = sellerId.replace(/^demo-/, "").replace(/[^a-z0-9]+/g, "");
  return providers.map((provider) => ({
    provider,
    url:
      provider === "tiktok"
        ? `https://www.tiktok.com/@${handle}`
        : provider === "instagram"
          ? `https://www.instagram.com/${handle}`
          : `https://www.facebook.com/${handle}`,
  }));
}

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
    socialProofs: demoSocial("demo-mina", ["instagram", "facebook"]),
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
    socialProofs: demoSocial("demo-jon", ["tiktok", "instagram"]),
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
    socialProofs: demoSocial("demo-lena", ["instagram", "facebook", "tiktok"]),
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
    socialProofs: demoSocial("demo-caro", ["facebook"]),
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
    socialProofs: demoSocial("demo-noah", ["instagram", "tiktok"]),
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
    socialProofs: demoSocial("demo-marcus", ["instagram"]),
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
    socialProofs: demoSocial("demo-ray", ["facebook", "tiktok"]),
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
    socialProofs: demoSocial("demo-avi", ["instagram"]),
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
    socialProofs: demoSocial("demo-ana", ["instagram", "facebook"]),
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
    socialProofs: demoSocial("demo-dev", ["tiktok"]),
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
    socialProofs: demoSocial("demo-ellis", ["instagram", "facebook"]),
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
    socialProofs: demoSocial("demo-sam", ["instagram", "tiktok"]),
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

type ComposeSeed = {
  title: string;
  price: string;
  category: string;
  condition: string;
  format: string;
  delivery: string;
  location: string;
  description: string;
  shippingPackage: Listing["shippingPackage"];
};

function composeSeedFromListing(listing: Listing): ComposeSeed {
  return {
    title: listing.title,
    price: String(listing.priceCents / 100),
    category: listing.category,
    condition: listing.condition,
    format: listing.format,
    delivery: listing.delivery,
    location: listing.locationLabel,
    description: listing.description,
    shippingPackage: listing.shippingPackage ?? null,
  };
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

function isArchiveListing(listing: Pick<Listing, "archive" | "status">) {
  return Boolean(listing.archive) || listing.status === "sold";
}

function normalizeRegistryListing(row: RegistryRow): Listing {
  const archive = Boolean(row.archive) || row.status === "sold";
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: String(row.title ?? "Untitled listing"),
    description: archive ? "" : String(row.description ?? ""),
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
    socialCreditScore: Number(row.socialCreditScore ?? 0),
    status: row.status === "sold" || archive ? "sold" : "active",
    archive,
    soldAt: row.soldAt ? String(row.soldAt) : null,
    socialProofs: archive
      ? []
      : parseJsonArray<SocialProof>(row.socialProofs ?? row.socialProofsJson),
    imageManifest: archive
      ? []
      : parseJsonArray<Listing["imageManifest"][number]>(
          row.imageManifest ?? row.imageManifestJson,
        ),
    paymentDestinations: archive
      ? []
      : row.paymentDestinations ??
        parsePaymentDestinationsJson(row.paymentDestinationsJson),
    paypalLinked: archive ? false : Boolean(row.paypalLinked),
    shippingPackage: archive ? null : row.shippingPackage ?? null,
    mediaAvailability: "offline",
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    endingAt: row.endingAt ? String(row.endingAt) : null,
    source: "registry",
  };
}

function listingPhotoLoader(listing: Listing) {
  const origins = publicMediaOriginsFromManifests(listing.imageManifest);
  return (hash: string) => getLocalMediaUrl(hash, origins);
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
  if (provider === "twitter") return "x";
  if (provider === "linkedin") return "in";
  if (provider === "reddit") return "rd";
  if (provider === "discord") return "dc";
  return "id";
}

function reputationFor(listing: Listing) {
  const demo = listing.source === "demo" ? demoReputation[listing.sellerId] : undefined;
  const itemsSold = listing.itemsSold ?? demo?.itemsSold ?? 0;
  const sellerRating = listing.sellerRating ?? demo?.sellerRating;
  const sellerRatingCount = listing.sellerRatingCount ?? demo?.sellerRatingCount ?? 0;
  const buyerRating = listing.buyerRating ?? demo?.buyerRating;
  const buyerRatingCount = listing.buyerRatingCount ?? demo?.buyerRatingCount ?? 0;
  return {
    itemsSold,
    sellerRating,
    sellerRatingCount,
    buyerRating,
    buyerRatingCount,
    socialCreditScore:
      listing.socialCreditScore ??
      computeSocialCreditScore({
        sellerRating,
        sellerRatingCount,
        buyerRating,
        buyerRatingCount,
        itemsSold,
        connectedSocial: connectedSocialCreditInput(
          listing.source === "demo" ? [] : listing.socialProofs,
        ),
      }),
  };
}

function socialAccountsFor(listing: Listing): SocialProof[] {
  const proofs =
    listing.source === "demo"
      ? listing.socialProofs
      : listing.socialProofs.filter((account) => account.metricsSource === "oauth");
  return proofs.map((account, index) => {
    if (isConnectedFacebookProof(account)) {
      return {
        ...account,
        url: account.url,
        handle: account.handle?.trim() || undefined,
        accountCreatedAt: undefined,
        connectionCount: undefined,
        metricsSource: "oauth",
        health: "active",
        healthMessage: "Connected with Facebook Login.",
        connectionLabel: "friends",
      };
    }
    if (account.metricsSource === "oauth") {
      return {
        ...account,
        handle: account.handle?.trim() || listing.sellerName,
        health: "active",
      };
    }
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

function missingConnectorNote(accounts: SocialProof[]) {
  const missing = publicConnectorCatalog(accounts)
    .filter((row) => !row.connected)
    .map((row) => row.label);
  if (!missing.length) return null;
  return <span className="no-social">Not connected: {missing.join(", ")}</span>;
}

function SocialAccountFact({
  account,
  className,
  variant,
}: {
  account: SocialProof;
  className: string;
  variant: "card" | "detail";
}) {
  const connectedOauth = account.metricsSource === "oauth";
  const connectedFacebook = isConnectedFacebookProof(account);
  const official = officialConnectorDisplay(
    connectedFacebook
      ? { ...factsFromSocialProof(account), connectionCount: null, accountCreatedAt: null }
      : factsFromSocialProof(account),
  );
  const officialLine = officialConnectorLine(official);
  const statusClass = `${className} status-${account.health ?? "unknown"}${
    connectedOauth ? " social-connected" : ""
  }`;
  const copy = connectedOauth ? (
    <>
      <strong>
        {variant === "detail"
          ? `${providerName(account.provider)}${official.headline ? ` · ${official.headline}` : " · Connected"}`
          : official.headline || account.handle || providerName(account.provider)}
      </strong>
      <small>
        {connectedFacebook
          ? "Connected with Facebook Login"
          : `Connected with ${providerName(account.provider)}`}
        {officialLine ? ` · ${officialLine}` : ""}
      </small>
      {official.providerVerified ? (
        <small>
          {providerName(account.provider)} shows its own verified mark on this
          account. That is not an Open Marketplace verification badge.
        </small>
      ) : null}
    </>
  ) : variant === "detail" ? (
    <>
      <strong>
        {providerName(account.provider)} · @{account.handle}
      </strong>
      <small>
        Created {formatAccountDate(account.accountCreatedAt)} · {formatCompactCount(account.connectionCount)} {account.connectionLabel ?? "connections"} · {account.metricsSource === "oauth" ? "provider verified" : "self-reported"}
      </small>
    </>
  ) : (
    <>
      <strong>@{account.handle ?? providerName(account.provider)}</strong>
      <small>
        Joined {formatAccountDate(account.accountCreatedAt)} · {formatCompactCount(account.connectionCount)} {account.connectionLabel ?? "connections"}
      </small>
    </>
  );
  const inner = (
    <>
      <span className="proof-mark">{socialLabel(account.provider)}</span>
      {variant === "card" ? <span className="social-fact-copy">{copy}</span> : <span>{copy}</span>}
      <span className="link-health">
        {connectedOauth ? "Connected" : healthLabel(account.health)}
      </span>
    </>
  );
  return (
    <ConnectorAnchor
      href={socialProfileHref(account.url)}
      className={statusClass}
      title={officialLine || account.healthMessage}
      label={`Open ${providerName(account.provider)} profile`}
    >
      {inner}
    </ConnectorAnchor>
  );
}

function ConnectorAnchor({
  href,
  className,
  title,
  label,
  children,
}: {
  href?: string;
  className: string;
  title?: string;
  label: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
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
  return (
    socialAccountsFor(listing).some(
      (account) => account.health === "dead" || account.health === "invalid",
    ) ||
    (listing.paymentDestinations ?? []).some(
      (destination) => destination.health === "dead" || destination.health === "invalid",
    )
  );
}

function paypalLinkLabel(listing: Listing) {
  return listing.paypalLinked ? "PayPal · Linked" : "PayPal · Not linked";
}

function socialProfileHref(value?: string) {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const path = url.pathname.replace(/\/+$/, "");
    if (!path) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function listingPayDetails(listing: Listing) {
  return {
    amountCents: listing.priceCents,
    currency: listing.currency || "USD",
    itemName: listing.title,
    kind: "goods_and_services" as const,
  };
}

function paypalConnectorHref(listing: Listing) {
  const paypal = (listing.paymentDestinations ?? []).find(
    (destination) => destination.rail === "paypal",
  );
  return paypal ? paymentLinkFor(paypal, listingPayDetails(listing)).href ?? "" : "";
}

function healthLabel(health: SocialProof["health"]) {
  if (health === "active") return "Live";
  if (health === "dead" || health === "invalid") return "Fix or remove";
  if (health === "checking") return "Checking";
  return "Recheck blocked";
}

function providerName(provider: SocialProof["provider"]) {
  return socialConnectorById(provider)?.label ?? (
    provider === "tiktok" ? "TikTok" : provider.charAt(0).toUpperCase() + provider.slice(1)
  );
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
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const [dragPhotoIndex, setDragPhotoIndex] = useState<number | null>(null);
  const [dropPhotoIndex, setDropPhotoIndex] = useState<number | null>(null);
  const [localMedia, setLocalMedia] = useState<Record<string, string>>({});
  const [listingPhotos, setListingPhotos] = useState<Record<string, string[]>>({});
  const [cardPhotoIndex, setCardPhotoIndex] = useState<Record<string, number>>({});
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectZoom, setInspectZoom] = useState(1);
  const [inspectPan, setInspectPan] = useState({ x: 0, y: 0 });
  const [inspectDragging, setInspectDragging] = useState(false);
  const inspectPointer = useRef<{ x: number; y: number } | null>(null);
  const inspectRootRef = useRef<HTMLDivElement | null>(null);
  const inspectViewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composeOpened, setComposeOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [composeSeed, setComposeSeed] = useState<ComposeSeed | null>(null);
  const [composeDelivery, setComposeDelivery] = useState("Pickup");
  const [shippingQuotes, setShippingQuotes] = useState<
    { carrier: string; serviceName: string; description: string; totalPrice: string }[]
  >([]);
  const [shippingQuoteMessage, setShippingQuoteMessage] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [contacting, setContacting] = useState(false);

  const donationUrl = process.env.NEXT_PUBLIC_DONATION_URL ?? "";
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    if (!signedIn || composeOpened || modal === "create") return;
    if (new URLSearchParams(window.location.search).get("compose") !== "1") return;

    const frame = window.requestAnimationFrame(() => {
      setComposeOpened(true);
      setEditingListingId(null);
      setComposeSeed(null);
      setPhotoDrafts([]);
      setModal("create");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [composeOpened, modal, signedIn]);

  useEffect(() => {
    if (editOpened || sessionPending) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;
    const listingId = params.get("listing")?.trim() ?? "";
    if (!listingId) return;
    if (!signedIn) {
      window.location.assign(
        `/login?returnTo=${encodeURIComponent(`/?listing=${listingId}&edit=1`)}`,
      );
      return;
    }
    const listing = listings.find((item) => item.id === listingId);
    if (!listing || listing.sellerId !== session?.user.id) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      setEditOpened(true);
      setEditingListingId(listing.id);
      setComposeSeed(composeSeedFromListing(listing));
      setComposeDelivery(listing.delivery);
      setPhotoDrafts(photoDraftsFromManifest(listing.imageManifest));
      setSelectedListing(listing);
      setModal("create");
      void (async () => {
        const pinned = await pinListingMediaToHost(listing.imageManifest).catch(
          () => listing.imageManifest,
        );
        const drafts = await photoDraftsFromExisting(pinned, listingPhotoLoader({
          ...listing,
          imageManifest: pinned,
        }));
        if (!cancelled) setPhotoDrafts(drafts);
      })();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [editOpened, listings, session?.user.id, sessionPending, signedIn]);

  const requestLinkHealth = useCallback(async (listing: Listing) => {
    const response = await fetch("/api/link-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accounts: listing.socialProofs,
        destinations: listing.paymentDestinations ?? [],
      }),
    });
    if (!response.ok) throw new Error("Social and payment links could not be checked");
    const payload = (await response.json()) as {
      accounts?: SocialProof[];
      destinations?: PaymentDestination[];
    };
    return {
      accounts: payload.accounts ?? listing.socialProofs,
      destinations: payload.destinations ?? listing.paymentDestinations ?? [],
    };
  }, []);

  const applyListingLinkHealth = useCallback((listing: Listing, checked: {
    accounts: SocialProof[];
    destinations: PaymentDestination[];
  }) => {
    const updated = {
      ...listing,
      socialProofs: checked.accounts,
      paymentDestinations: checked.destinations,
    };
    setListings((current) =>
      current.map((item) => (item.id === listing.id ? updated : item)),
    );
    setSelectedListing((current) =>
      current?.id === listing.id ? updated : current,
    );
    return updated;
  }, []);

  useEffect(() => {
    if (
      !selectedListing ||
      selectedListing.source !== "registry" ||
      isArchiveListing(selectedListing)
    ) {
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(`om-link-health:${selectedListing.id}`);
    } catch {
      stored = null;
    }
    if (isLinkCheckFresh(stored) || !listingLinksNeedCheck(selectedListing)) return;
    let cancelled = false;
    void requestLinkHealth(selectedListing)
      .then((checked) => {
        if (cancelled) return;
        applyListingLinkHealth(selectedListing, checked);
        try {
          window.localStorage.setItem(
            `om-link-health:${selectedListing.id}`,
            new Date().toISOString(),
          );
        } catch {
          // Device storage is optional for the 24-hour check cycle.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applyListingLinkHealth, requestLinkHealth, selectedListing]);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        const listingId =
          new URLSearchParams(window.location.search).get("listing")?.trim() ?? "";
        const response = await fetch("/api/listings?limit=80", {
          headers: { accept: "application/json" },
        });
        const payload = response.ok
          ? ((await response.json()) as { listings?: RegistryRow[] })
          : { listings: [] };
        if (cancelled) return;
        let registryListings = (payload.listings ?? []).map(normalizeRegistryListing);
        const node = readMediaNodeConfig();
        if (node) {
          try {
            const catalog = await fetchReplicaCatalog(node.origin);
            const seen = new Map(registryListings.map((listing) => [listing.id, listing]));
            for (const row of catalog.listings) {
              const extra = normalizeRegistryListing(row);
              const current = seen.get(extra.id);
              if (!current) {
                seen.set(extra.id, extra);
                registryListings.push(extra);
                continue;
              }
              const hosts = publicMediaOriginsFromManifests(extra.imageManifest);
              if (!hosts.length) continue;
              current.imageManifest = current.imageManifest.map((asset, index) => ({
                ...asset,
                hosts: [
                  ...new Set([
                    ...(asset.hosts ?? []),
                    ...(extra.imageManifest[index]?.hosts ?? []),
                    ...hosts,
                  ]),
                ],
              }));
            }
          } catch {
            // The Synology host is optional; Cloudflare D1 or demo data still works.
          }
        }
        let archiveListing: Listing | null = null;
        if (
          listingId &&
          !registryListings.some((listing) => listing.id === listingId)
        ) {
          const one = await fetch(
            `/api/listings?id=${encodeURIComponent(listingId)}&limit=1`,
            { headers: { accept: "application/json" } },
          );
          if (one.ok) {
            const onePayload = (await one.json()) as { listings?: RegistryRow[] };
            const extra = onePayload.listings?.[0];
            if (extra) {
              const normalized = normalizeRegistryListing(extra);
              if (isArchiveListing(normalized)) {
                archiveListing = normalized;
              } else {
                registryListings = [normalized, ...registryListings];
              }
            }
          }
        }
        if (cancelled) return;
        if (registryListings.length) setListings(registryListings);
        const deepLink =
          archiveListing ??
          (listingId
            ? registryListings.find((listing) => listing.id === listingId)
            : null);
        if (deepLink) {
          setSelectedListing(deepLink);
          setModal("detail");
        }
        if (!registryListings.length) return;

        const ownerId = session?.user.id;
        for (const listing of registryListings) {
          if (!listing.imageManifest.length) continue;
          const urls = await collectPhotoUrlsInOrder(
            listing.imageManifest.map((asset) => asset.hash),
            listingPhotoLoader(listing),
          );
          if (!cancelled) {
            setListingPhotos((current) => ({ ...current, [listing.id]: urls }));
            if (urls[0]) {
              setLocalMedia((current) => ({ ...current, [listing.id]: urls[0] }));
            }
            if (urls.some(Boolean)) {
              setListings((current) =>
                current.map((item) =>
                  item.id === listing.id
                    ? { ...item, mediaAvailability: "local" }
                    : item,
                ),
              );
            }
            if (ownerId && listing.sellerId === ownerId) {
              void pinListingMediaToHost(listing.imageManifest).catch(() => {});
            }
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
  }, [session?.user.id]);

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

  function writeInspectView(next: { zoom: number; pan: { x: number; y: number } }) {
    inspectViewRef.current = next;
    setInspectZoom(next.zoom);
    setInspectPan(next.pan);
  }

  function closeInspect() {
    const reset = resetInspectView();
    setInspectOpen(false);
    writeInspectView(reset);
    setInspectDragging(false);
    inspectPointer.current = null;
  }

  function openInspect() {
    writeInspectView(resetInspectView());
    setInspectOpen(true);
  }

  const loadListingPhotos = useCallback(async (listing: Listing) => {
    if (!listing.imageManifest.length) return;
    const urls = await collectPhotoUrlsInOrder(
      listing.imageManifest.map((asset) => asset.hash),
      listingPhotoLoader(listing),
    );
    setListingPhotos((current) => ({ ...current, [listing.id]: urls }));
    if (urls[0]) {
      setLocalMedia((current) => ({ ...current, [listing.id]: urls[0] }));
    }
  }, []);

  function photosForListing(listing: Listing): string[] {
    const stored = listingPhotos[listing.id];
    if (stored?.length) return stored;
    return listing.imageManifest.map((_, index) =>
      index === 0 && localMedia[listing.id] ? localMedia[listing.id] : "",
    );
  }

  function openDetail(listing: Listing) {
    closeInspect();
    setDetailPhotoIndex(cardPhotoIndex[listing.id] ?? 0);
    setSelectedListing(listing);
    setModal("detail");
    void loadListingPhotos(listing);
  }

  const selectedPhotos = selectedListing ? photosForListing(selectedListing) : [];
  const photoCount = selectedListing
    ? listingPhotoCount(selectedListing.imageManifest.length)
    : 0;
  const safePhotoIndex = clampPhotoIndex(detailPhotoIndex, photoCount);
  const selectedPhoto = selectedPhotos[safePhotoIndex] || null;

  useEffect(() => {
    if (modal !== "detail" || !selectedListing) return;
    const count = photoCount;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && inspectOpen) {
        event.preventDefault();
        closeInspect();
        return;
      }
      if (event.key === "ArrowRight" && count > 1) {
        event.preventDefault();
        setDetailPhotoIndex((current) => stepPhotoIndex(current, count, 1));
        if (inspectOpen) {
          writeInspectView(resetInspectView());
        }
      }
      if (event.key === "ArrowLeft" && count > 1) {
        event.preventDefault();
        setDetailPhotoIndex((current) => stepPhotoIndex(current, count, -1));
        if (inspectOpen) {
          writeInspectView(resetInspectView());
        }
      }
      if (!inspectOpen) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const current = inspectViewRef.current;
        writeInspectView({
          zoom: stepInspectZoom(current.zoom, 1),
          pan: current.pan,
        });
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        const current = inspectViewRef.current;
        writeInspectView({
          zoom: stepInspectZoom(current.zoom, -1),
          pan: current.pan,
        });
      }
      if (event.key === "0") {
        event.preventDefault();
        writeInspectView(resetInspectView());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectOpen, modal, photoCount, selectedListing]);

  function handleInspectPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    inspectPointer.current = { x: event.clientX, y: event.clientY };
    setInspectDragging(true);
  }

  function handleInspectPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!inspectDragging || !inspectPointer.current) return;
    const last = inspectPointer.current;
    const current = inspectViewRef.current;
    writeInspectView({
      zoom: current.zoom,
      pan: applyInspectPan(
        current.pan,
        event.clientX - last.x,
        event.clientY - last.y,
        current.zoom,
      ),
    });
    inspectPointer.current = { x: event.clientX, y: event.clientY };
  }

  function handleInspectPointerUp() {
    inspectPointer.current = null;
    setInspectDragging(false);
  }

  function changeInspectPhoto(delta: number) {
    setDetailPhotoIndex((current) => stepPhotoIndex(current, photoCount, delta));
    writeInspectView(resetInspectView());
  }

  useEffect(() => {
    if (!inspectOpen) return;
    const node = inspectRootRef.current;
    if (!node) return;

    type SafariGestureEvent = Event & {
      scale: number;
      clientX: number;
      clientY: number;
    };

    let gestureStart = inspectViewRef.current;
    let gestureActive = false;

    function originFromClient(clientX: number, clientY: number) {
      const rect = node.getBoundingClientRect();
      return {
        x: clientX - (rect.left + rect.width / 2),
        y: clientY - (rect.top + rect.height / 2),
      };
    }

    function commit(next: { zoom: number; pan: { x: number; y: number } }) {
      inspectViewRef.current = next;
      setInspectZoom(next.zoom);
      setInspectPan(next.pan);
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      if (gestureActive) return;
      const origin = originFromClient(event.clientX, event.clientY);
      commit(
        applyInspectWheel(inspectViewRef.current, {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          pinch: event.ctrlKey || event.metaKey,
          originX: origin.x,
          originY: origin.y,
        }),
      );
    }

    function onGestureStart(event: Event) {
      event.preventDefault();
      gestureActive = true;
      gestureStart = inspectViewRef.current;
    }

    function onGestureChange(event: Event) {
      event.preventDefault();
      const gesture = event as SafariGestureEvent;
      const origin = originFromClient(gesture.clientX, gesture.clientY);
      commit(applyInspectGestureScale(gestureStart, gesture.scale, origin.x, origin.y));
    }

    function onGestureEnd(event: Event) {
      event.preventDefault();
      gestureActive = false;
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("gesturestart", onGestureStart);
    node.addEventListener("gesturechange", onGestureChange);
    node.addEventListener("gestureend", onGestureEnd);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("gesturestart", onGestureStart);
      node.removeEventListener("gesturechange", onGestureChange);
      node.removeEventListener("gestureend", onGestureEnd);
    };
  }, [inspectOpen]);

  function startCreate() {
    if (sessionPending) return;
    if (!signedIn) {
      window.location.assign("/login?returnTo=/%3Fcompose%3D1");
      return;
    }
    setEditingListingId(null);
    setComposeSeed(null);
    setComposeDelivery("Pickup");
    photoDrafts.forEach(revokePhotoDraft);
    setPhotoDrafts([]);
    setShippingQuotes([]);
    setShippingQuoteMessage("");
    setModal("create");
  }

  function openEdit(listing: Listing) {
    if (sessionPending) return;
    if (!signedIn) {
      window.location.assign(
        `/login?returnTo=${encodeURIComponent(`/?listing=${listing.id}&edit=1`)}`,
      );
      return;
    }
    if (listing.sellerId !== session?.user.id) {
      setToast("Only the listing owner can edit this item.");
      return;
    }
    setEditingListingId(listing.id);
    setComposeSeed(composeSeedFromListing(listing));
    setComposeDelivery(listing.delivery);
    photoDrafts.forEach(revokePhotoDraft);
    setPhotoDrafts(photoDraftsFromManifest(listing.imageManifest));
    setShippingQuotes([]);
    setShippingQuoteMessage("");
    setSelectedListing(listing);
    setModal("create");
    void (async () => {
      const pinned = await pinListingMediaToHost(listing.imageManifest).catch(
        () => listing.imageManifest,
      );
      setPhotoDrafts(await photoDraftsFromExisting(pinned, listingPhotoLoader({
        ...listing,
        imageManifest: pinned,
      })));
    })();
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, listing: Listing) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail(listing);
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotoDrafts((current) => appendPhotoFiles(current, files, URL.createObjectURL));
    event.target.value = "";
  }

  function handleRemovePhoto(index: number) {
    setPhotoDrafts((current) => {
      const draft = current[index];
      if (draft) revokePhotoDraft(draft);
      return removePhotoDraft(current, index);
    });
  }

  function handleMovePhoto(from: number, to: number) {
    setPhotoDrafts((current) => movePhotoDraft(current, from, to));
  }

  function handlePhotoDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    event.dataTransfer.setData(PHOTO_DRAG_TYPE, String(index));
    event.dataTransfer.setData("text/plain", String(index));
    event.dataTransfer.effectAllowed = "move";
    setDragPhotoIndex(index);
  }

  function handlePhotoDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropPhotoIndex !== index) setDropPhotoIndex(index);
  }

  function handlePhotoDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const from =
      photoDragIndex(event.dataTransfer.getData(PHOTO_DRAG_TYPE), photoDrafts.length) ??
      photoDragIndex(event.dataTransfer.getData("text/plain"), photoDrafts.length);
    if (from != null) handleMovePhoto(from, index);
    setDragPhotoIndex(null);
    setDropPhotoIndex(null);
  }

  function handlePhotoDragEnd() {
    setDragPhotoIndex(null);
    setDropPhotoIndex(null);
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
      let imageManifest = await manifestsFromPhotoDrafts(photoDrafts, storeMedia);
      let hostCopyFailed = false;
      try {
        imageManifest = await pinListingMediaToHost(imageManifest);
      } catch {
        hostCopyFailed = true;
      }

      const payload = {
        ...(editingListingId ? { id: editingListingId } : {}),
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
        socialProofs: [],
        imageManifest,
        endingAt:
          String(formData.get("format")) === "Auction"
            ? new Date(Date.now() + 3 * 86_400_000).toISOString()
            : null,
      };

      let listing: Listing;
      try {
        const response = await fetch("/api/listings", {
          method: editingListingId ? "PATCH" : "POST",
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
          setToast(
            editingListingId
              ? "Log in to edit this listing."
              : "Log in to publish this listing.",
          );
          window.location.assign(
            editingListingId
              ? `/login?returnTo=${encodeURIComponent(`/?listing=${editingListingId}&edit=1`)}`
              : "/login?returnTo=/%3Fcompose%3D1",
          );
          return;
        }
        if (response.status === 403) {
          setToast(result.error ?? "Only the listing owner can edit this item.");
          return;
        }
        if (response.status === 422) {
          setToast(
            result.error ??
              "Fix Social Media Connectors in Account settings before publishing.",
          );
          return;
        }
        if (!response.ok || !result.listing) throw new Error("Registry write failed");
        listing = normalizeRegistryListing(result.listing);
        listing.imageManifest = imageManifest;
        listing.mediaAvailability = imageManifest.length ? "local" : "offline";
      } catch {
        if (editingListingId) {
          setToast("The listing could not be saved.");
          return;
        }
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
      void publishReplicaSnapshot(listing).catch(() => {});

      setListings((current) =>
        editingListingId
          ? current.map((item) => (item.id === listing.id ? listing : item))
          : [listing, ...current],
      );
      setSelectedListing(listing);
      const publishedUrls = previewUrlsFromPhotoDrafts(photoDrafts);
      if (publishedUrls.length) {
        setListingPhotos((current) => ({ ...current, [listing.id]: publishedUrls }));
        setLocalMedia((current) => ({ ...current, [listing.id]: publishedUrls[0] }));
        setDetailPhotoIndex(0);
      }
      setPhotoDrafts([]);
      setEditingListingId(null);
      setComposeSeed(null);
      setModal(editingListingId ? "detail" : null);
      setToast(
        listing.source === "registry"
          ? editingListingId
            ? hostCopyFailed
              ? "Listing updated. Photos could not be copied to your database host."
              : "Listing updated. Your host kept a copy of this item and its photos."
            : hostCopyFailed
              ? "Listing published. Photos could not be copied to your database host."
              : "Listing published. Your host kept a copy of this item and its photos."
          : "Saved on this device; the registry is not connected in this preview.",
      );
    } catch {
      setToast("The listing could not be saved on this device.");
    } finally {
      setSubmitting(false);
    }
  }

  async function recheckListingLinks(listing: Listing, silent = false) {
    if (listing.source === "demo") {
      if (!silent) {
        setToast("Demo trust data is illustrative; real profiles are rechecked live.");
      }
      return;
    }
    if (!silent) setToast("Rechecking social and payment links…");
    const checked = await requestLinkHealth(listing).catch(() => null);
    if (!checked) {
      if (!silent) {
        setToast("The platforms did not allow a recheck right now.");
      }
      return;
    }
    applyListingLinkHealth(listing, checked);
    try {
      window.localStorage.setItem(
        `om-link-health:${listing.id}`,
        new Date().toISOString(),
      );
    } catch {
      // Device storage is optional for the 24-hour check cycle.
    }
    if (silent) return;
    const brokenSocial = checked.accounts.some(
      (account) => account.health === "dead" || account.health === "invalid",
    );
    const brokenPayment = checked.destinations.some(
      (destination) => destination.health === "dead" || destination.health === "invalid",
    );
    setToast(
      brokenSocial || brokenPayment
        ? "A dead link was found. The seller must fix or remove it."
        : "Social and payment links rechecked.",
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

  async function contactSeller(listing: Listing) {
    if (isArchiveListing(listing) || listing.sellerId === session?.user.id) return;
    if (!signedIn) {
      window.location.assign(
        `/login?returnTo=${encodeURIComponent(`/?listing=${listing.id}`)}`,
      );
      return;
    }
    setContacting(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        conversation?: { id?: string };
      };
      if (!response.ok || !payload.conversation?.id) {
        setToast(payload.error ?? "Could not open the conversation.");
        return;
      }
      window.location.assign(
        `/account/messages?id=${encodeURIComponent(payload.conversation.id)}`,
      );
    } catch {
      setToast("Could not open the conversation.");
    } finally {
      setContacting(false);
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
            onClick={startCreate}
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
              const cardPhotos = photosForListing(listing);
              const cardCount = listingPhotoCount(listing.imageManifest.length);
              const cardIndex = clampPhotoIndex(cardPhotoIndex[listing.id] ?? 0, cardCount);
              const cardPhoto = cardPhotos[cardIndex] || localMedia[listing.id] || "";
              return (
                <article
                  className="listing-card"
                  key={listing.id}
                  tabIndex={0}
                  aria-label={`View ${listing.title}`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button")) return;
                    openDetail(listing);
                  }}
                  onKeyDown={(event) => handleCardKey(event, listing)}
                >
                  <div className={`listing-media tone-${visual.tone}`}>
                    <span className="media-glyph" aria-hidden="true">{visual.glyph}</span>
                    {cardPhoto ? (
                      // Native blob URLs are intentionally used; these bytes never hit a server.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="local-image" src={cardPhoto} alt="Seller-held listing media" />
                    ) : null}
                    <span className="media-badge">
                      <span className="online-dot" />
                      {listing.mediaAvailability === "local"
                        ? "on this device"
                        : listing.mediaAvailability === "online"
                          ? "seller online"
                          : "request media"}
                    </span>
                    {cardCount > 1 ? (
                      <>
                        <span className="photo-count-badge">
                          {cardIndex + 1}/{cardCount}
                        </span>
                        <button
                          type="button"
                          className="detail-photo-nav prev"
                          aria-label="Previous photo"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCardPhotoIndex((current) => ({
                              ...current,
                              [listing.id]: stepPhotoIndex(cardIndex, cardCount, -1),
                            }));
                          }}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="detail-photo-nav next"
                          aria-label="Next photo"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCardPhotoIndex((current) => ({
                              ...current,
                              [listing.id]: stepPhotoIndex(cardIndex, cardCount, 1),
                            }));
                          }}
                        >
                          ›
                        </button>
                      </>
                    ) : null}
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
                      <span title="Official social Connect is the first line of defense before verified buys and sells. Not a credit-bureau score. Not a verification badge.">
                        Social Credit {reputation.socialCreditScore}
                      </span>
                    </div>
                    <div className="social-facts" aria-label={`${socialAccounts.length} linked social accounts`}>
                      {socialAccounts.length ? socialAccounts.map((account, index) => (
                        <SocialAccountFact
                          account={account}
                          className="social-fact"
                          variant="card"
                          key={`${account.provider}-${index}`}
                        />
                      )) : (
                        <span className="no-social">No social account supplied</span>
                      )}
                      {listing.source === "registry" ? (
                        <ConnectorAnchor
                          href={paypalConnectorHref(listing)}
                          className={`social-fact social-connected status-${listing.paypalLinked ? "active" : "unknown"}`}
                          title={
                            listing.paypalLinked
                              ? "Linked with PayPal Login"
                              : "Seller has not linked PayPal"
                          }
                          label="Pay with PayPal"
                        >
                          <span className="proof-mark">pp</span>
                          <span className="social-fact-copy">
                            <strong>{paypalLinkLabel(listing)}</strong>
                            <small>
                              {listing.paypalLinked
                                ? "Linked with PayPal Login"
                                : "Seller has not linked PayPal"}
                            </small>
                          </span>
                          <span className="link-health">
                            {listing.paypalLinked ? "Linked" : "Not linked"}
                          </span>
                        </ConnectorAnchor>
                      ) : null}
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
          <button
            className="scrim"
            aria-label="Close dialog"
            onClick={() => {
              if (inspectOpen) {
                closeInspect();
                return;
              }
              setModal(null);
            }}
          />
          {modal === "create" && (
            <div className="modal modal-create" role="dialog" aria-modal="true" aria-labelledby="create-title">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">
                    {editingListingId ? "Edit your listing" : "Publish metadata only"}
                  </span>
                  <h2 id="create-title">{editingListingId ? "Edit listing" : "List an item"}</h2>
                  <p>Your selected photos stay in this browser’s local media vault.</p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close"
                  onClick={() => setModal(editingListingId && selectedListing ? "detail" : null)}
                >
                  ×
                </button>
              </div>

              <form key={editingListingId ?? "new-listing"} onSubmit={submitListing}>
                <div className="form-grid">
                  <div className="field field-full">
                    <label htmlFor="title">Title</label>
                    <input
                      id="title"
                      name="title"
                      required
                      maxLength={90}
                      placeholder="What are you selling?"
                      defaultValue={composeSeed?.title ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="price">Price</label>
                    <input
                      id="price"
                      name="price"
                      required
                      min="0"
                      step="1"
                      type="number"
                      placeholder="$0"
                      defaultValue={composeSeed?.price ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select id="category" name="category" defaultValue={composeSeed?.category ?? "Furniture"}>
                      {categories.slice(1).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="condition">Condition</label>
                    <select id="condition" name="condition" defaultValue={composeSeed?.condition ?? "Good"}>
                      {['New', 'Like new', 'Good', 'Fair'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="format">Format</label>
                    <select id="format" name="format" defaultValue={composeSeed?.format ?? "Fixed price"}>
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
                    <input
                      id="location"
                      name="location"
                      required
                      placeholder="Brooklyn, NY"
                      defaultValue={composeSeed?.location ?? ""}
                    />
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
                          <input id="weightLb" name="weightLb" type="number" min="0.1" max="70" step="0.1" placeholder="2" defaultValue={composeSeed?.shippingPackage?.weightLb ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="lengthIn">Length (in)</label>
                          <input id="lengthIn" name="lengthIn" type="number" min="1" max="80" step="0.1" placeholder="12" defaultValue={composeSeed?.shippingPackage?.lengthIn ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="widthIn">Width (in)</label>
                          <input id="widthIn" name="widthIn" type="number" min="1" max="80" step="0.1" placeholder="9" defaultValue={composeSeed?.shippingPackage?.widthIn ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="heightIn">Height (in)</label>
                          <input id="heightIn" name="heightIn" type="number" min="1" max="80" step="0.1" placeholder="6" defaultValue={composeSeed?.shippingPackage?.heightIn ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="originPostal">Origin postal</label>
                          <input id="originPostal" name="originPostal" placeholder="11215" defaultValue={composeSeed?.shippingPackage?.originPostal ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="destPostal">Destination postal</label>
                          <input id="destPostal" name="destPostal" placeholder="10001" defaultValue={composeSeed?.shippingPackage?.destPostal ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor="originCountry">Origin country</label>
                          <input id="originCountry" name="originCountry" maxLength={2} defaultValue={composeSeed?.shippingPackage?.originCountry ?? "US"} />
                        </div>
                        <div className="field">
                          <label htmlFor="destCountry">Destination country</label>
                          <input id="destCountry" name="destCountry" maxLength={2} defaultValue={composeSeed?.shippingPackage?.destCountry ?? "US"} />
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
                    <textarea
                      id="description"
                      name="description"
                      required
                      maxLength={1400}
                      placeholder="Condition, dimensions, pickup details…"
                      defaultValue={composeSeed?.description ?? ""}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Listing photos</label>
                    {photoDrafts.length > 0 && (
                      <p className="form-note photo-order-note">
                        Drag photos to change the display order. The first photo
                        is the one shown on the listings page.
                      </p>
                    )}
                    {photoDrafts.length > 0 && (
                      <div className="photo-editor">
                        {photoDrafts.map((photo, index) => (
                          <div
                            className={`photo-draft${dragPhotoIndex === index ? " is-dragging" : ""}${dropPhotoIndex === index ? " is-drop-target" : ""}`}
                            key={photo.key}
                            draggable
                            onDragStart={(event) => handlePhotoDragStart(event, index)}
                            onDragOver={(event) => handlePhotoDragOver(event, index)}
                            onDrop={(event) => handlePhotoDrop(event, index)}
                            onDragEnd={handlePhotoDragEnd}
                          >
                            {index === 0 && (
                              <span className="photo-draft-cover">Listings page</span>
                            )}
                            {photo.previewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photo.previewUrl}
                                alt={photo.name || `Photo ${index + 1}`}
                                draggable={false}
                              />
                            ) : (
                              <div className="photo-draft-missing">
                                <strong>{photo.name || `Photo ${index + 1}`}</strong>
                                <span>Not on this device or first database host</span>
                              </div>
                            )}
                            <div className="photo-draft-actions">
                              <button
                                type="button"
                                disabled={index === 0}
                                aria-label="Move photo left"
                                onClick={() => handleMovePhoto(index, index - 1)}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                disabled={index === photoDrafts.length - 1}
                                aria-label="Move photo right"
                                onClick={() => handleMovePhoto(index, index + 1)}
                              >
                                →
                              </button>
                              <button
                                type="button"
                                aria-label="Remove photo"
                                onClick={() => handleRemovePhoto(index)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {photoDrafts.length < LISTING_PHOTO_LIMIT ? (
                      <label className="upload-box">
                        <span className="upload-symbol" aria-hidden="true">⌁</span>
                        <span className="upload-copy">
                          <strong>Add photos</strong>
                          <span>
                            {photoDrafts.length} of {LISTING_PHOTO_LIMIT} · hashed locally · copied to your first database host when connected · never uploaded to the registry
                          </span>
                        </span>
                        <input type="file" accept="image/*" multiple onChange={handleFiles} />
                      </label>
                    ) : (
                      <p className="form-note">Six photos assigned. Remove one to add another.</p>
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
                      Listing ownership comes from your signed-in account. Social trust comes from Social Media Connectors in Account settings.
                    </small>
                  </div>
                </div>
                <p className="form-note">
                  Publishing confirms the item is lawful where offered. Social trust is copied from Social Media Connectors in Account settings, not entered on this form.
                </p>
                <div className="modal-actions">
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => setModal(editingListingId && selectedListing ? "detail" : null)}
                  >
                    Cancel
                  </button>
                  <button className="button button-primary" type="submit" disabled={submitting}>
                    {submitting
                      ? editingListingId
                        ? "Saving…"
                        : "Publishing…"
                      : editingListingId
                        ? "Save changes"
                        : "Publish listing"}
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
                  <span className="eyebrow">
                    {isArchiveListing(selectedListing)
                      ? "Sold archive"
                      : `${selectedListing.category} · ${selectedListing.condition}`}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close"
                  onClick={() => {
                    if (inspectOpen) {
                      closeInspect();
                      return;
                    }
                    setModal(null);
                  }}
                >
                  ×
                </button>
              </div>
              {isArchiveListing(selectedListing) ? (
                <div className="detail-copy">
                  <span className="eyebrow">
                    Sold {selectedListing.soldAt ? relativeTime(selectedListing.soldAt) : "recently"}
                  </span>
                  <h2 id="detail-title">{selectedListing.title}</h2>
                  <div className="detail-price">{formatPrice(selectedListing)}</div>
                  <div className="seller-card">
                    <strong>Sold by {selectedListing.sellerName}</strong>
                    <p>This public record is compressed. Photos, pay-to contacts, and messages stay off the homepage.</p>
                  </div>
                  <div className="modal-actions">
                    <button className="button button-ghost" onClick={() => void shareListing(selectedListing)}>Share</button>
                  </div>
                </div>
              ) : (
              <div className="detail-grid">
                <div className="detail-gallery">
                  <div className={`detail-media tone-${(categoryVisuals[selectedListing.category] ?? { tone: "slate" }).tone}`}>
                    <span className="media-glyph" aria-hidden="true">
                      {(categoryVisuals[selectedListing.category] ?? { glyph: "OE" }).glyph}
                    </span>
                    {selectedPhoto ? (
                      <button
                        type="button"
                        className="detail-photo-open"
                        onClick={openInspect}
                        aria-label="Inspect listing photo"
                      >
                        {/* Native blob URLs are intentionally used; these bytes never hit a server. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="local-image" src={selectedPhoto} alt="" />
                      </button>
                    ) : null}
                    {photoCount > 1 ? (
                      <>
                        <button
                          type="button"
                          className="detail-photo-nav prev"
                          aria-label="Previous photo"
                          onClick={() => {
                            setDetailPhotoIndex((current) =>
                              stepPhotoIndex(current, photoCount, -1),
                            );
                          }}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="detail-photo-nav next"
                          aria-label="Next photo"
                          onClick={() => {
                            setDetailPhotoIndex((current) =>
                              stepPhotoIndex(current, photoCount, 1),
                            );
                          }}
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                  </div>
                  {photoCount > 1 ? (
                    <div className="detail-photo-thumbs" role="listbox" aria-label="Listing photos">
                      {selectedListing.imageManifest.map((asset, index) => {
                        const url = selectedPhotos[index] || "";
                        return (
                          <button
                            key={asset.hash || `photo-${index}`}
                            type="button"
                            role="option"
                            className={index === safePhotoIndex ? "is-selected" : ""}
                            aria-label={`Show photo ${index + 1} of ${photoCount}`}
                            aria-selected={index === safePhotoIndex}
                            onClick={() => setDetailPhotoIndex(index)}
                          >
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt="" />
                            ) : (
                              <span className="detail-photo-missing">{index + 1}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
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
                      <div title="Official social Connect is the first line of defense before verified buys and sells. Not a credit-bureau score. Not a verification badge.">
                        <span>Social Credit</span>
                        <strong>{reputationFor(selectedListing).socialCreditScore}</strong>
                      </div>
                    </div>
                    <div className="detail-social-list">
                      {socialAccountsFor(selectedListing).length ? (
                        socialAccountsFor(selectedListing).map((account, index) => (
                          <SocialAccountFact
                            account={account}
                            className="detail-social-account"
                            variant="detail"
                            key={`${account.provider}-${index}`}
                          />
                        ))
                      ) : (
                        <span className="no-social">No social account supplied</span>
                      )}
                      {selectedListing.source === "demo" ? null : missingConnectorNote(
                        socialAccountsFor(selectedListing),
                      )}
                    </div>
                    <button
                      className="recheck-button"
                      onClick={() => void recheckListingLinks(selectedListing)}
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
                      <ConnectorAnchor
                        href={paypalConnectorHref(selectedListing)}
                        className={`detail-social-account social-connected status-${selectedListing.paypalLinked ? "active" : "unknown"}`}
                        title={
                          selectedListing.paypalLinked
                            ? "This PayPal account is currently linked with PayPal Login."
                            : "This seller has not linked PayPal."
                        }
                        label="Pay with PayPal"
                      >
                        <span className="proof-mark">pp</span>
                        <span>
                          <strong>{paypalLinkLabel(selectedListing)}</strong>
                          <small>
                            {selectedListing.paypalLinked
                              ? "This PayPal account is currently linked with PayPal Login."
                              : "This seller has not linked PayPal."}
                          </small>
                        </span>
                        <span className="link-health">
                          {selectedListing.paypalLinked ? "Linked" : "Not linked"}
                        </span>
                      </ConnectorAnchor>
                      {paymentLinksFor(
                        selectedListing.paymentDestinations ?? [],
                        listingPayDetails(selectedListing),
                      ).length
                        ? paymentLinksFor(
                            selectedListing.paymentDestinations ?? [],
                            listingPayDetails(selectedListing),
                          ).map((link) => (
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
                      {photoCount
                        ? photoCount > 1
                          ? "These images stay in the seller’s local vault or host. Click a photo icon or use previous/next, then inspect. On a trackpad, pinch to zoom and swipe with two fingers to move."
                          : "This image was loaded from your device’s local vault. Click it to inspect. On a trackpad, pinch to zoom and swipe with two fingers to move."
                        : "The registry has no image bytes. A peer transfer is requested when the seller is online."}
                    </p>
                  </div>
                  <div className="modal-actions">
                    {signedIn && session?.user.id === selectedListing.sellerId ? (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => openEdit(selectedListing)}
                      >
                        Edit listing
                      </button>
                    ) : null}
                    <button className="button button-ghost" onClick={() => void shareListing(selectedListing)}>Share</button>
                    {session?.user.id === selectedListing.sellerId ? null : (
                      <button
                        className="button button-primary"
                        disabled={hasBrokenAccount(selectedListing) || contacting}
                        onClick={() => void contactSeller(selectedListing)}
                      >
                        {hasBrokenAccount(selectedListing)
                          ? "Seller must repair profile"
                          : contacting
                            ? "Opening…"
                            : "Contact seller"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
          {inspectOpen && selectedPhoto ? (
            <div
              ref={inspectRootRef}
              className="listing-inspect"
              role="dialog"
              aria-modal="true"
              aria-label="Inspect listing photo"
              onClick={closeInspect}
            >
              <div
                className="listing-inspect-stage"
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className={`listing-inspect-canvas${inspectDragging ? " is-dragging" : ""}`}
                  onPointerDown={handleInspectPointerDown}
                  onPointerMove={handleInspectPointerMove}
                  onPointerUp={handleInspectPointerUp}
                  onPointerCancel={handleInspectPointerUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhoto}
                    alt=""
                    draggable={false}
                    style={{ transform: inspectTransform(inspectZoom, inspectPan) }}
                  />
                </div>
                <div className="listing-inspect-tools">
                  <button
                    type="button"
                    className="button button-ghost"
                    aria-label="Zoom out"
                    onClick={() => {
                      const current = inspectViewRef.current;
                      writeInspectView({
                        zoom: stepInspectZoom(current.zoom, -1),
                        pan: current.pan,
                      });
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    aria-label="Reset zoom"
                    onClick={() => writeInspectView(resetInspectView())}
                  >
                    Reset zoom
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    aria-label="Zoom in"
                    onClick={() => {
                      const current = inspectViewRef.current;
                      writeInspectView({
                        zoom: stepInspectZoom(current.zoom, 1),
                        pan: current.pan,
                      });
                    }}
                  >
                    +
                  </button>
                  {photoCount > 1 ? (
                    <>
                      <button
                        type="button"
                        className="button button-ghost"
                        aria-label="Previous photo"
                        onClick={() => changeInspectPhoto(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        aria-label="Next photo"
                        onClick={() => changeInspectPhoto(1)}
                      >
                        ›
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="button button-dark" onClick={closeInspect}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <footer className="site-legal">
        <p>Open Marketplace is an independent classifieds site.</p>
        <p>
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Terms</a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy/facebook-data-deletion">Facebook data deletion</a>
        </p>
      </footer>
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
