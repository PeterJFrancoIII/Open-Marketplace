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
  about: string | null;
  location: string | null;
  hometown: string | null;
  websiteUrl: string | null;
  locale: string | null;
  gender: string | null;
  ageRange: string | null;
  coverUrl: string | null;
};

export type PaypalOAuthLastReturn =
  | "started"
  | "linked"
  | "paypal"
  | "paypal-state"
  | "paypal-session"
  | "paypal-token";

export type PayPalConnection = {
  available: boolean;
  connected: boolean;
  email: string | null;
  paypalMe: string | null;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  imageUrl: string | null;
  accountType: string | null;
  verifiedAccount: boolean | null;
  locale: string | null;
  lastReturn?: PaypalOAuthLastReturn | null;
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
  displayName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  shortName?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: "friends" | "followers" | "connections";
  followingCount?: number;
  likesCount?: number;
  contentCount?: number;
  hasOfficialImage?: boolean;
  hasBio?: boolean;
  hasLocation?: boolean;
  hasWebsite?: boolean;
  hasBanner?: boolean;
  hasAccountType?: boolean;
  hasProviderBadge?: boolean;
  listedCount?: number;
  imageUrl?: string;
  bio?: string;
  location?: string;
  hometown?: string;
  websiteUrl?: string;
  bannerUrl?: string;
  locale?: string;
  gender?: string;
  ageRange?: string;
  accountType?: string;
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
