import {
  EVIDENCE_PHOTOS_PER_KIND,
  EVIDENCE_PHOTO_STORE_MAX_BYTES,
} from "./evidence-limits.ts";
import {
  extractEvidenceMetadata,
  sanitizeEvidenceExif,
  type EvidenceExif,
} from "./exif-jpeg.ts";
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

export type SalePhotoManifest = MediaManifest & {
  exif?: EvidenceExif | null;
  width?: number;
  height?: number;
  quality?: "full" | "archival";
};

export function sanitizeSalePhoto(
  value: unknown,
  kind: SalePhotoKind,
): SalePhotoManifest | null {
  const [photo] = sanitizeSalePhotos(value, kind);
  return photo ?? null;
}

export function sanitizeSalePhotos(
  value: unknown,
  kind: SalePhotoKind,
): SalePhotoManifest[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  if (list.length > EVIDENCE_PHOTOS_PER_KIND) return [];
  const allowed = kind === "paymentReceipt" ? RECEIPT_TYPES : SALE_IMAGE_TYPES;
  const photos: SalePhotoManifest[] = [];
  for (const item of list) {
    const [manifest] = sanitizeImageManifest([item]);
    if (!manifest || !allowed.has(manifest.type.toLowerCase())) continue;
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const width = Number(row.width);
    const height = Number(row.height);
    photos.push({
      hash: manifest.hash,
      name: manifest.name,
      size: manifest.size,
      type: manifest.type,
      hosts: manifest.hosts,
      exif: sanitizeEvidenceExif(row.exif),
      width: Number.isFinite(width) && width > 0 ? Math.round(width) : undefined,
      height: Number.isFinite(height) && height > 0 ? Math.round(height) : undefined,
      quality: row.quality === "archival" ? "archival" : "full",
    });
  }
  return photos;
}

export function hasSalePhoto(value: unknown) {
  if (Array.isArray(value)) return value.some(Boolean);
  return Boolean(value);
}

export const EVIDENCE_PHOTO_MAX_BYTES = EVIDENCE_PHOTO_STORE_MAX_BYTES;

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
  | {
      ok: true;
      manifest: SalePhotoManifest;
      bytes: Uint8Array;
      bytesBase64: string;
      exif: EvidenceExif;
    }
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
  const exif = extractEvidenceMetadata(bytes, manifest.type);
  return {
    ok: true,
    manifest: {
      ...manifest,
      size: bytes.length,
      exif,
      width: exif.width,
      height: exif.height,
      quality: manifest.quality === "archival" ? "archival" : "full",
    },
    bytes,
    bytesBase64: bytesToBase64(bytes),
    exif,
  };
}

export async function verifySalePhotoUploads(
  value: unknown,
  kind: SalePhotoKind,
): Promise<
  | {
      ok: true;
      items: Array<{
        manifest: SalePhotoManifest;
        bytes: Uint8Array;
        bytesBase64: string;
        exif: EvidenceExif;
      }>;
    }
  | { ok: false; error: string }
> {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  if (!list.length) {
    return { ok: false, error: "Upload at least one photo of this evidence type." };
  }
  if (list.length > EVIDENCE_PHOTOS_PER_KIND) {
    return {
      ok: false,
      error: `Use at most ${EVIDENCE_PHOTOS_PER_KIND} photos of each evidence type.`,
    };
  }
  const items = [];
  for (const item of list) {
    const verified = await verifySalePhotoUpload(item, kind);
    if (!verified.ok) return verified;
    items.push(verified);
  }
  return { ok: true, items };
}

export function parseSalePhotoJson(
  value: string | null | undefined,
  kind: SalePhotoKind,
): SalePhotoManifest[] {
  if (!value) return [];
  try {
    return sanitizeSalePhotos(JSON.parse(value), kind);
  } catch {
    return [];
  }
}

export function serializeSalePhoto(manifest: SalePhotoManifest | SalePhotoManifest[] | null) {
  if (!manifest) return null;
  const photos = Array.isArray(manifest) ? manifest : [manifest];
  return photos.length ? JSON.stringify(photos) : null;
}

export function saleEvidenceMissing(
  role: SaleEvidenceRole,
  status: "pending" | "in_transfer" | "complete",
  evidence: {
    trackingNumber?: string | null;
    paymentReceipt?: unknown;
    receivedItem?: unknown;
    receivedPackaging?: unknown;
    shippedItem?: unknown;
    shippedPackaging?: unknown;
  },
): string | null {
  if (status === "pending") return null;
  if (role === "seller") {
    if (!requireActualTrackingNumber(evidence.trackingNumber)) {
      return "Enter the actual UPS, USPS, FedEx, or DHL tracking number for this item.";
    }
    if (!hasSalePhoto(evidence.shippedItem) || !hasSalePhoto(evidence.shippedPackaging)) {
      return "Upload a photo of the item and the shipping box before marking In-Transfer.";
    }
    return null;
  }
  if (status === "in_transfer") {
    return "Only the seller marks In-Transfer. Accept the shipping evidence instead.";
  }
  if (status === "complete") {
    if (!hasSalePhoto(evidence.paymentReceipt)) {
      return "Upload a copy of the payment receipt before marking Complete.";
    }
    if (!hasSalePhoto(evidence.receivedItem) || !hasSalePhoto(evidence.receivedPackaging)) {
      return "Upload a photo of the product and its packaging before marking Complete.";
    }
  }
  return null;
}
