export const MESSAGE_MAX_LENGTH = 1000;
export const RATING_NOTE_MIN = 20;
export const RATING_NOTE_MAX = 280;
export const EVIDENCE_REQUEST_NOTE_MIN = 10;
export const EVIDENCE_REQUEST_NOTE_MAX = 280;
export const MESSAGE_HOUR_LIMIT = 30;

export const SALE_STATUSES = ["pending", "in_transfer", "complete"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export function isSaleStatus(value: unknown): value is SaleStatus {
  return SALE_STATUSES.includes(value as SaleStatus);
}

export function saleStatusLabel(status: SaleStatus) {
  if (status === "in_transfer") return "In-Transfer";
  if (status === "complete") return "Complete";
  return "Pending";
}
