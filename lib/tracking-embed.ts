import {
  compactTracking,
  detectTrackingCarrier,
  normalizeTrackingNumber,
  requireActualTrackingNumber,
  type TrackingCarrier,
} from "./tracking-number.ts";

export const TRACKING_EMBED_SCRIPT = "https://www.17track.net/externalcall.js";
export type { TrackingCarrier };
export { requireActualTrackingNumber };

export type SaleTrackingDetails = {
  number: string;
  kind: "pickup" | "carrier";
  carrier: TrackingCarrier;
  carrierLabel: string;
  officialHref: string | null;
  aftershipHref: string | null;
  embedHref: string | null;
};

const OFFICIAL_HOSTS = new Set([
  "www.ups.com",
  "tools.usps.com",
  "www.fedex.com",
  "www.dhl.com",
  "www.aftership.com",
  "t.17track.net",
]);

function officialHref(carrier: TrackingCarrier, compact: string) {
  const encoded = encodeURIComponent(compact);
  if (carrier === "ups") {
    return `https://www.ups.com/track?loc=en_US&tracknum=${encoded}`;
  }
  if (carrier === "usps") {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  }
  if (carrier === "fedex") {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  }
  if (carrier === "dhl") {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
  }
  return null;
}

function carrierLabel(carrier: TrackingCarrier) {
  if (carrier === "ups") return "UPS";
  if (carrier === "usps") return "USPS";
  if (carrier === "fedex") return "FedEx";
  if (carrier === "dhl") return "DHL";
  return "Carrier";
}

export function isOfficialTrackingHref(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OFFICIAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function saleTrackingDetails(value: unknown): SaleTrackingDetails | null {
  const number = normalizeTrackingNumber(value);
  if (!number) return null;
  if (/^pickup$/i.test(number)) {
    return {
      number,
      kind: "pickup",
      carrier: "unknown",
      carrierLabel: "Pickup",
      officialHref: null,
      aftershipHref: null,
      embedHref: null,
    };
  }
  const compact = compactTracking(number);
  if (compact.length < 8) return null;
  const carrier = detectTrackingCarrier(compact);
  const encoded = encodeURIComponent(compact);
  return {
    number,
    kind: "carrier",
    carrier,
    carrierLabel: carrierLabel(carrier),
    officialHref: officialHref(carrier, compact),
    aftershipHref: `https://www.aftership.com/track/${encoded}`,
    embedHref: `https://t.17track.net/en/track?nums=${encoded}`,
  };
}
