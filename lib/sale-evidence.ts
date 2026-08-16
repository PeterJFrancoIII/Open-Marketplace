import { sanitizeImageManifest } from "./image-manifest.ts";
import {
  TRACKING_MAX,
  TRACKING_MIN,
  normalizeTrackingNumber,
  requireActualTrackingNumber,
} from "./tracking-number.ts";
import type { MediaManifest } from "./types";

export { TRACKING_MAX, TRACKING_MIN, normalizeTrackingNumber };

const SALE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const RECEIPT_TYPES = new Set([...SALE_IMAGE_TYPES, "application/pdf"]);

export type SaleEvidenceRole = "buyer" | "seller";

export type SalePhotoKind =
  | "paymentReceipt"
  | "receivedItem"
  | "receivedPackaging"
  | "shippedItem"
  | "shippedPackaging";

export function sanitizeSalePhoto(
  value: unknown,
  kind: SalePhotoKind,
): MediaManifest | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const [manifest] = sanitizeImageManifest(list);
  if (!manifest) return null;
  const allowed = kind === "paymentReceipt" ? RECEIPT_TYPES : SALE_IMAGE_TYPES;
  if (!allowed.has(manifest.type.toLowerCase())) return null;
  return {
    hash: manifest.hash,
    name: manifest.name,
    size: manifest.size,
    type: manifest.type,
    hosts: manifest.hosts,
  };
}

export function parseSalePhotoJson(
  value: string | null | undefined,
  kind: SalePhotoKind,
): MediaManifest | null {
  if (!value) return null;
  try {
    return sanitizeSalePhoto(JSON.parse(value), kind);
  } catch {
    return null;
  }
}

export function serializeSalePhoto(manifest: MediaManifest | null) {
  return manifest ? JSON.stringify(manifest) : null;
}

export function saleEvidenceMissing(
  role: SaleEvidenceRole,
  status: "pending" | "in_transfer" | "complete",
  evidence: {
    trackingNumber?: string | null;
    paymentReceipt?: MediaManifest | null;
    receivedItem?: MediaManifest | null;
    receivedPackaging?: MediaManifest | null;
    shippedItem?: MediaManifest | null;
    shippedPackaging?: MediaManifest | null;
  },
): string | null {
  if (status === "pending") return null;
  if (role === "seller") {
    if (!requireActualTrackingNumber(evidence.trackingNumber)) {
      return "Enter the actual UPS, USPS, FedEx, or DHL tracking number for this item.";
    }
    if (!evidence.shippedItem || !evidence.shippedPackaging) {
      return "Upload a photo of the item and the shipping box before marking In-Transfer.";
    }
    return null;
  }
  if (status === "in_transfer") {
    return "Only the seller marks In-Transfer. Accept the shipping evidence instead.";
  }
  if (status === "complete") {
    if (!evidence.paymentReceipt) {
      return "Upload a copy of the payment receipt before marking Complete.";
    }
    if (!evidence.receivedItem || !evidence.receivedPackaging) {
      return "Upload a photo of the product and its packaging before marking Complete.";
    }
  }
  return null;
}
