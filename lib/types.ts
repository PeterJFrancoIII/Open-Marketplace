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
  profileUrl: string | null;
};

export type PayPalConnection = {
  available: boolean;
  connected: boolean;
  email: string | null;
};

export type SocialProof = {
  provider:
    | "facebook"
    | "instagram"
    | "tiktok"
    | "twitter"
    | "linkedin"
    | "reddit"
    | "discord"
    | "other";
  url: string;
  handle?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: "friends" | "followers" | "connections";
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
  source?: "self-reported" | "oauth";
  health?: SocialProof["health"];
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
  socialCreditScore?: number;
  status?: "active" | "draft" | "sold";
  archive?: boolean;
  soldAt?: string | null;
  socialProofs: SocialProof[];
  imageManifest: MediaManifest[];
  mediaAvailability: "local" | "online" | "offline";
  createdAt: string;
  endingAt: string | null;
  source: "demo" | "registry" | "device";
  paymentDestinations?: PaymentDestination[];
  paypalLinked?: boolean;
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
