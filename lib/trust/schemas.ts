import { InvalidTrustTransitionError } from "./state-machines.ts";

const MAX_LISTING_JSON_BYTES = 48_000;
const MAX_MANIFEST_ITEMS = 12;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 8_000;

const FORBIDDEN_KEY =
  /^(data|blob|base64|bytes|binary|imageData|fileContents|contentBase64|thumbnailData)$/i;
const DATA_URL = /^data:/i;
const BASE64ISH = /^(?:[A-Za-z0-9+/]{200,}={0,2})$/;

export type StrictListingMediaManifestItem = {
  contentHash: string;
  mimeType: string;
  filename: string;
  byteLength: number;
};

function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidTrustTransitionError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectBinaryShaped(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (DATA_URL.test(value) || value.startsWith("blob:")) {
      throw new InvalidTrustTransitionError(`${path} must not contain data/blob URLs`);
    }
    if (value.length > 400 && BASE64ISH.test(value.replace(/\s/g, ""))) {
      throw new InvalidTrustTransitionError(`${path} looks like a base64 media payload`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => rejectBinaryShaped(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) {
        throw new InvalidTrustTransitionError(`Forbidden media field: ${path}.${key}`);
      }
      rejectBinaryShaped(child, `${path}.${key}`);
    }
  }
}

function pickString(
  obj: Record<string, unknown>,
  key: string,
  max: number,
  required = false,
): string | undefined {
  const value = obj[key];
  if (value == null) {
    if (required) throw new InvalidTrustTransitionError(`${key} is required`);
    return undefined;
  }
  if (typeof value !== "string") {
    throw new InvalidTrustTransitionError(`${key} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new InvalidTrustTransitionError(`${key} is required`);
  if (trimmed.length > max) {
    throw new InvalidTrustTransitionError(`${key} exceeds ${max} characters`);
  }
  return trimmed;
}

/** Strict listing write schema — unknown fields stripped; media bytes rejected. */
export function parseStrictListingWrite(input: unknown): {
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: string;
  category: string;
  locationLabel: string;
  format: string;
  delivery: string;
  sellerName: string;
  socialProofs: unknown[];
  imageManifest: StrictListingMediaManifestItem[];
  endingAt: string | null;
} {
  const raw = assertPlainObject(input, "listing");
  rejectBinaryShaped(raw, "listing");

  const json = JSON.stringify(raw);
  if (json.length > MAX_LISTING_JSON_BYTES) {
    throw new InvalidTrustTransitionError(
      `Listing payload exceeds ${MAX_LISTING_JSON_BYTES} bytes`,
    );
  }

  const title = pickString(raw, "title", MAX_TITLE, true)!;
  const description = pickString(raw, "description", MAX_DESCRIPTION, true)!;
  const priceCents = Number(raw.priceCents);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1_000_000_000) {
    throw new InvalidTrustTransitionError("priceCents must be a non-negative integer");
  }

  const manifestRaw = Array.isArray(raw.imageManifest)
    ? raw.imageManifest
    : Array.isArray(raw.imageManifestJson)
      ? raw.imageManifestJson
      : [];
  if (manifestRaw.length > MAX_MANIFEST_ITEMS) {
    throw new InvalidTrustTransitionError(`At most ${MAX_MANIFEST_ITEMS} media manifest items`);
  }

  const imageManifest: StrictListingMediaManifestItem[] = manifestRaw.map((item, index) => {
    const row = assertPlainObject(item, `imageManifest[${index}]`);
    rejectBinaryShaped(row, `imageManifest[${index}]`);
    const allowed = new Set(["contentHash", "mimeType", "filename", "byteLength", "size"]);
    for (const key of Object.keys(row)) {
      if (!allowed.has(key)) {
        // strip unknown by omission
      }
    }
    const contentHash = pickString(row, "contentHash", 128, true)!;
    if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
      throw new InvalidTrustTransitionError("contentHash must be sha-256 hex");
    }
    const mimeType = pickString(row, "mimeType", 100, true)!;
    if (!mimeType.startsWith("image/")) {
      throw new InvalidTrustTransitionError("mimeType must be an image/* type");
    }
    const filename = pickString(row, "filename", 180, true)!;
    const byteLength = Number(row.byteLength ?? row.size);
    if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > 20_000_000) {
      throw new InvalidTrustTransitionError("byteLength must be a positive integer ≤ 20MB metadata only");
    }
    return { contentHash: contentHash.toLowerCase(), mimeType, filename, byteLength };
  });

  const socialProofs = Array.isArray(raw.socialProofs) ? raw.socialProofs : [];
  rejectBinaryShaped(socialProofs, "socialProofs");

  return {
    title,
    description,
    priceCents,
    currency: pickString(raw, "currency", 8) ?? "USD",
    condition: pickString(raw, "condition", 40, true)!,
    category: pickString(raw, "category", 80, true)!,
    locationLabel: pickString(raw, "locationLabel", 120, true)!,
    format: pickString(raw, "format", 40) ?? "Fixed price",
    delivery: pickString(raw, "delivery", 40) ?? "Pickup",
    sellerName: pickString(raw, "sellerName", 80, true)!,
    socialProofs,
    imageManifest,
    endingAt: pickString(raw, "endingAt", 40) ?? null,
  };
}

const MAX_EXTERNAL_CREDENTIAL_BYTES = 24_000;

/** Strict external credential import — strip unknown; reject media-shaped fields. */
export function parseStrictExternalCredential(input: unknown): Record<string, unknown> {
  const raw = assertPlainObject(input, "credential");
  rejectBinaryShaped(raw, "credential");
  const json = JSON.stringify(raw);
  if (json.length > MAX_EXTERNAL_CREDENTIAL_BYTES) {
    throw new InvalidTrustTransitionError(
      `External credential exceeds ${MAX_EXTERNAL_CREDENTIAL_BYTES} bytes`,
    );
  }

  const allowedTop = new Set([
    "@context",
    "type",
    "id",
    "issuer",
    "validFrom",
    "validUntil",
    "credentialSubject",
    "credentialStatus",
    "proof",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!allowedTop.has(key)) continue;
    out[key] = value;
  }
  if (!out.type || !out.issuer || !out.credentialSubject) {
    throw new InvalidTrustTransitionError("credential missing required VC fields");
  }
  return out;
}

export function assertSameOriginRelativeReturnTo(returnTo: unknown): string {
  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    throw new InvalidTrustTransitionError("returnTo must be a same-origin relative path");
  }
  if (returnTo.includes("://") || returnTo.includes("\\")) {
    throw new InvalidTrustTransitionError("returnTo must be a same-origin relative path");
  }
  return returnTo.slice(0, 512);
}
