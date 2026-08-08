/** Local IndexedDB vault shape (bytes stay on device). */
export type MediaManifest = {
  hash: string;
  name: string;
  size: number;
  type: string;
};

/** Registry-safe metadata only — never include image bytes. */
export type RegistryMediaManifest = {
  contentHash: string;
  mimeType: string;
  filename: string;
  byteLength: number;
};

export type SocialProof = {
  provider: "facebook" | "instagram" | "tiktok" | "other";
  url: string;
  handle?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: "friends" | "followers";
  metricsSource?: "self-reported" | "oauth";
  health?: "active" | "dead" | "unknown" | "invalid" | "checking";
  lastCheckedAt?: string;
  healthMessage?: string;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: "New" | "Like new" | "Good" | "Fair";
  category: string;
  locationLabel: string;
  distanceMiles: number | null;
  format: "Fixed price" | "Auction";
  delivery: "Pickup" | "Shipping" | "Both";
  sellerId: string;
  sellerName: string;
  itemsSold?: number;
  sellerRating?: number;
  sellerRatingCount?: number;
  buyerRating?: number;
  buyerRatingCount?: number;
  socialProofs: SocialProof[];
  imageManifest: MediaManifest[];
  mediaAvailability: "local" | "online" | "offline";
  createdAt: string;
  endingAt: string | null;
  source: "demo" | "registry" | "device";
};

export type ListingDraft = Omit<
  Listing,
  "id" | "createdAt" | "source" | "mediaAvailability"
>;
