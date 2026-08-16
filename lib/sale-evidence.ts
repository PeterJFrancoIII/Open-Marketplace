import { sanitizeImageManifest } from "./image-manifest.ts";
import type { MediaManifest } from "./types";

export const TRACKING_MIN = 4;
export const TRACKING_MAX = 80;

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

export type SalePhotoKind = "paymentReceipt" | "receivedItem" | "receivedPackaging";

export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < TRACKING_MIN || trimmed.length > TRACKING_MAX) return null;
  if (/https?:|javascript:|data:|<|>/i.test(trimmed)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]*[A-Za-z0-9]$/.test(trimmed)) return null;
  return trimmed;
}

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
  },
): string | null {
  if (status === "pending") return null;
  if (role === "seller") {
    if (!evidence.trackingNumber) {
      return "Add the tracking number before marking In-Transfer or Complete.";
    }
    return null;
  }
  if (status === "in_transfer" && !evidence.paymentReceipt) {
    return "Upload a copy of the payment receipt before marking In-Transfer.";
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
