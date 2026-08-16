export type SocialCreditInput = {
  sellerRating?: number | null;
  sellerRatingCount?: number | null;
  buyerRating?: number | null;
  buyerRatingCount?: number | null;
  itemsSold?: number | null;
};

export function computeSocialCreditScore(input: SocialCreditInput): number {
  const parts: number[] = [];
  if ((input.sellerRatingCount ?? 0) > 0 && input.sellerRating != null) {
    parts.push(clampRating(input.sellerRating) / 5);
  }
  if ((input.buyerRatingCount ?? 0) > 0 && input.buyerRating != null) {
    parts.push(clampRating(input.buyerRating) / 5);
  }
  if (!parts.length) return 0;
  const ratingPart = parts.reduce((sum, value) => sum + value, 0) / parts.length;
  const volumePart = Math.min(Math.max(input.itemsSold ?? 0, 0), 10) / 10;
  return Math.round(100 * (0.8 * ratingPart + 0.2 * volumePart));
}

function clampRating(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}
