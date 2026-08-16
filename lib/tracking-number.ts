export const TRACKING_MIN = 4;
export const TRACKING_MAX = 80;

export type TrackingCarrier = "ups" | "usps" | "fedex" | "dhl" | "unknown";

const STAND_IN_TRACKING =
  /^(pickup|pick up|picked up|n\/a|na|none|tbd|tba|tracking|track|shipped|local|handoff|in person|in-person|xxx+|0+|test)$/i;

export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < TRACKING_MIN || trimmed.length > TRACKING_MAX) return null;
  if (/https?:|javascript:|data:|<|>/i.test(trimmed)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]*[A-Za-z0-9]$/.test(trimmed)) return null;
  return trimmed;
}

export function compactTracking(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function detectTrackingCarrier(compact: string): TrackingCarrier {
  if (/^1Z[0-9A-Z]{16}$/.test(compact)) return "ups";
  if (/^(94|93|92|95|91|90)[0-9]{18,22}$/.test(compact)) return "usps";
  if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(compact)) return "usps";
  if (/^96[0-9]{18}$/.test(compact) || /^[0-9]{15}$/.test(compact) || /^[0-9]{12}$/.test(compact)) {
    return "fedex";
  }
  if (/^[0-9]{10}$/.test(compact)) return "dhl";
  return "unknown";
}

export function requireActualTrackingNumber(value: unknown): string | null {
  const number = normalizeTrackingNumber(value);
  if (!number) return null;
  const compact = compactTracking(number);
  if (STAND_IN_TRACKING.test(number) || STAND_IN_TRACKING.test(compact)) return null;
  if (compact.length < 8) return null;
  const carrier = detectTrackingCarrier(compact);
  if (carrier === "unknown") return null;
  return number;
}
