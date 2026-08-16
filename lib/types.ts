export type MediaManifest = {
  hash: string;
  name: string;
  size: number;
  type: string;
  hosts?: string[];
};

export type FacebookConnection = {
  available: boolean;
  connected: boolean;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  shortName: string | null;
  imageUrl: string | null;
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

export type PaymentRail =
  | "paypal"
  | "venmo"
  | "cashapp"
  | "zelle"
  | "apple_cash"
  | "bitcoin_mainnet"
  | "ethereum_mainnet"
  | "usdt_ethereum"
  | "bnb_bsc"
  | "usdc_ethereum";

export type PaymentDestination = {
  rail: PaymentRail;
  destination: string;
  asset: "BTC" | "ETH" | "USDT" | "BNB" | "USDC" | null;
  networkId: string | null;
  networkLabel: string | null;
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
  paymentDestinations?: PaymentDestination[];
  shippingPackage?: {
    weightLb: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    originPostal: string;
    originCountry: string;
    destPostal: string;
    destCountry: string;
  } | null;
};

export type ListingDraft = Omit<
  Listing,
  "id" | "createdAt" | "source" | "mediaAvailability"
>;
