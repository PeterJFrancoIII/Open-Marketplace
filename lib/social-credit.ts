export type ConnectedSocialCreditField = {
  provider: string;
  hasProfileUrl?: boolean;
  hasHandle?: boolean;
  hasDisplayName?: boolean;
  hasAccountCreatedAt?: boolean;
  hasConnectionCount?: boolean;
  hasImage?: boolean;
  hasBio?: boolean;
  hasFollowingCount?: boolean;
  hasLikesCount?: boolean;
  hasContentCount?: boolean;
  hasLocation?: boolean;
  hasWebsite?: boolean;
  hasBanner?: boolean;
  hasAccountType?: boolean;
  hasProviderBadge?: boolean;
};

export type SocialCreditInput = {
  sellerRating?: number | null;
  sellerRatingCount?: number | null;
  buyerRating?: number | null;
  buyerRatingCount?: number | null;
  itemsSold?: number | null;
  connectedSocial?: ConnectedSocialCreditField[];
};

export const SOCIAL_LINK_BONUS_CAP = 50;

const SOCIAL_CREDIT_PROVIDERS = new Set([
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "reddit",
  "discord",
]);

export function computeSocialCreditScore(input: SocialCreditInput): number {
  const parts: number[] = [];
  if ((input.sellerRatingCount ?? 0) > 0 && input.sellerRating != null) {
    parts.push(clampRating(input.sellerRating) / 5);
  }
  if ((input.buyerRatingCount ?? 0) > 0 && input.buyerRating != null) {
    parts.push(clampRating(input.buyerRating) / 5);
  }
  const linkBonus = connectedSocialBonus(input.connectedSocial);
  if (!parts.length) return linkBonus;
  const ratingPart = parts.reduce((sum, value) => sum + value, 0) / parts.length;
  const volumePart = Math.min(Math.max(input.itemsSold ?? 0, 0), 10) / 10;
  const ratingBase = Math.round(100 * (0.8 * ratingPart + 0.2 * volumePart));
  return Math.min(100, ratingBase + linkBonus);
}

export function connectedSocialBonus(
  accounts?: ConnectedSocialCreditField[] | null,
): number {
  if (!accounts?.length) return 0;
  const seen = new Set<string>();
  let points = 0;
  for (const account of accounts) {
    if (!SOCIAL_CREDIT_PROVIDERS.has(account.provider) || seen.has(account.provider)) {
      continue;
    }
    seen.add(account.provider);
    points += 2;
    if (account.hasProfileUrl) points += 1;
    if (account.hasHandle) points += 1;
    if (account.hasDisplayName) points += 1;
    if (account.hasAccountCreatedAt) points += 1;
    if (account.hasConnectionCount) points += 1;
    if (account.hasImage) points += 1;
    if (account.hasBio) points += 1;
    if (account.hasFollowingCount) points += 1;
    if (account.hasLikesCount) points += 1;
    if (account.hasContentCount) points += 1;
    if (account.hasLocation) points += 1;
    if (account.hasWebsite) points += 1;
    if (account.hasBanner) points += 1;
    if (account.hasAccountType) points += 1;
    if (account.hasProviderBadge) points += 1;
  }
  return Math.min(SOCIAL_LINK_BONUS_CAP, points);
}

function clampRating(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}
