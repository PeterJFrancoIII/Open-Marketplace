import { sanitizeImageManifest } from "./image-manifest.ts";
import { toSha256Hash } from "./media-node.ts";
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

export const EVIDENCE_PHOTO_MAX_BYTES = 600_000;

function decodeBase64Bytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    if (binary.length > EVIDENCE_PHOTO_MAX_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function readSalePhotoBytes(value: unknown): Uint8Array | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.dataUrl === "string") {
    const match = /^data:[a-z0-9.+/-]+;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      row.dataUrl.trim(),
    );
    return match ? decodeBase64Bytes(match[1]) : null;
  }
  return null;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifySalePhotoUpload(
  value: unknown,
  kind: SalePhotoKind,
): Promise<
  | { ok: true; manifest: MediaManifest; bytes: Uint8Array; bytesBase64: string }
  | { ok: false; error: string }
> {
  const manifest = sanitizeSalePhoto(value, kind);
  if (!manifest) {
    return {
      ok: false,
      error: "Upload a photo of the item. Image bytes stay off the public registry.",
    };
  }
  const bytes = readSalePhotoBytes(value);
  if (!bytes) {
    return {
      ok: false,
      error: "Upload the photo file so the other person can see it.",
    };
  }
  const digestSource = bytes.slice();
  const hash = await toSha256Hash(digestSource.buffer);
  if (hash !== manifest.hash) {
    return {
      ok: false,
      error: "Photo bytes do not match the evidence hash.",
    };
  }
  return {
    ok: true,
    manifest: { ...manifest, size: bytes.length },
    bytes,
    bytesBase64: bytesToBase64(bytes),
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
