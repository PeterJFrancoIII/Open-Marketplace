import { InvalidTrustTransitionError } from "./state-machines.ts";

const MAX_LISTING_JSON_BYTES = 48_000;
const MAX_MANIFEST_ITEMS = 12;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 8_000;
const MAX_NUMERIC_ARRAY = 32;

const FORBIDDEN_KEY =
  /^(data|blob|base64|bytes|binary|imageData|fileContents|contentBase64|thumbnailData|pixelData|buffer|rawBytes)$/i;
const DATA_URL = /^data:/i;
const BASE64ISH = /^(?:[A-Za-z0-9+/]{200,}={0,2})$/;

const SOCIAL_PROOF_KEYS = new Set([
  "provider",
  "url",
  "handle",
  "accountCreatedAt",
  "connectionCount",
  "connectionLabel",
  "metricsSource",
  "health",
  "lastCheckedAt",
  "healthMessage",
]);

const CREDENTIAL_SUBJECT_KEYS = new Set([
  "id",
  "profileId",
  "claimType",
  "value",
  "unit",
  "evidenceLabel",
  "registryId",
  "memberSince",
  "ratingCount",
  "completedSales",
  "completedPurchases",
  "provider",
  "connectedAt",
]);

const PROOF_KEYS = new Set([
  "type",
  "cryptosuite",
  "created",
  "verificationMethod",
  "proofPurpose",
  "proofValue",
]);

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

/** Reject binary-shaped values including numeric byte arrays. */
export function rejectBinaryShaped(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (DATA_URL.test(value) || value.startsWith("blob:")) {
      throw new InvalidTrustTransitionError(`${path} must not contain data/blob URLs`);
    }
    if (value.length > 400 && BASE64ISH.test(value.replace(/\s/g, ""))) {
      throw new InvalidTrustTransitionError(`${path} looks like a base64 media payload`);
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidTrustTransitionError(`${path} must be a finite number`);
    }
    return;
  }
  if (typeof value === "boolean" || value == null) return;

  if (Array.isArray(value)) {
    if (
      value.length > MAX_NUMERIC_ARRAY &&
      value.every((item) => typeof item === "number")
    ) {
      throw new InvalidTrustTransitionError(
        `${path} looks like a numeric byte array and is forbidden in the registry`,
      );
    }
    if (value.length > 0 && value.every((item) => typeof item === "number")) {
      // Any pure numeric array is treated as binary-shaped media bytes.
      throw new InvalidTrustTransitionError(
        `${path} must not contain numeric byte arrays`,
      );
    }
    value.forEach((item, i) => rejectBinaryShaped(item, `${path}[${i}]`));
    return;
  }

  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new InvalidTrustTransitionError(`${path} must not contain binary buffers`);
  }

  if (typeof value === "object") {
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

function normalizeContentHash(raw: string): string {
  const trimmed = raw.trim().replace(/^sha256:/i, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new InvalidTrustTransitionError("contentHash must be sha-256 hex");
  }
  return trimmed;
}

function parseManifestItem(
  item: unknown,
  index: number,
): StrictListingMediaManifestItem {
  const row = assertPlainObject(item, `imageManifest[${index}]`);
  rejectBinaryShaped(row, `imageManifest[${index}]`);

  const contentHashRaw =
    pickString(row, "contentHash", 128) ?? pickString(row, "hash", 128);
  if (!contentHashRaw) {
    throw new InvalidTrustTransitionError("contentHash is required");
  }
  const contentHash = normalizeContentHash(contentHashRaw);

  const mimeType =
    pickString(row, "mimeType", 100) ?? pickString(row, "type", 100);
  if (!mimeType) throw new InvalidTrustTransitionError("mimeType is required");
  if (!mimeType.startsWith("image/")) {
    throw new InvalidTrustTransitionError("mimeType must be an image/* type");
  }

  const filename =
    pickString(row, "filename", 180) ?? pickString(row, "name", 180);
  if (!filename) throw new InvalidTrustTransitionError("filename is required");

  const byteLength = Number(row.byteLength ?? row.size);
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > 20_000_000) {
    throw new InvalidTrustTransitionError(
      "byteLength must be a positive integer ≤ 20MB metadata only",
    );
  }

  // Explicit allow-list only — aliases normalized away.
  return { contentHash, mimeType, filename, byteLength };
}

function parseSocialProof(item: unknown, index: number): Record<string, unknown> {
  const row = assertPlainObject(item, `socialProofs[${index}]`);
  rejectBinaryShaped(row, `socialProofs[${index}]`);
  const out: Record<string, unknown> = {};
  for (const key of SOCIAL_PROOF_KEYS) {
    if (row[key] === undefined) continue;
    out[key] = row[key];
  }
  const provider = pickString(out, "provider", 40, true)!;
  if (!["facebook", "instagram", "tiktok", "other"].includes(provider)) {
    throw new InvalidTrustTransitionError(`Unsupported social provider: ${provider}`);
  }
  const url = pickString(out, "url", 500, true)!;
  if (!/^https:\/\//i.test(url)) {
    throw new InvalidTrustTransitionError("socialProofs.url must be https");
  }
  out.provider = provider;
  out.url = url;
  if (out.connectionCount != null) {
    const n = Number(out.connectionCount);
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
      throw new InvalidTrustTransitionError("connectionCount must be a non-negative integer");
    }
    out.connectionCount = n;
  }
  if (out.handle != null) out.handle = pickString(out, "handle", 120);
  if (out.accountCreatedAt != null) {
    out.accountCreatedAt = pickString(out, "accountCreatedAt", 40);
  }
  if (out.connectionLabel != null) {
    out.connectionLabel = pickString(out, "connectionLabel", 40);
  }
  if (out.metricsSource != null) {
    out.metricsSource = pickString(out, "metricsSource", 40);
  }
  if (out.health != null) out.health = pickString(out, "health", 40);
  if (out.lastCheckedAt != null) {
    out.lastCheckedAt = pickString(out, "lastCheckedAt", 40);
  }
  if (out.healthMessage != null) {
    out.healthMessage = pickString(out, "healthMessage", 240);
  }
  return out;
}

function pickAllowedObject(
  value: unknown,
  allowed: Set<string>,
  label: string,
): Record<string, unknown> {
  const row = assertPlainObject(value, label);
  rejectBinaryShaped(row, label);
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (row[key] === undefined) continue;
    const child = row[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      // Nested objects only allowed for `value` with scalar/json-safe leaves.
      if (key === "value") {
        rejectBinaryShaped(child, `${label}.value`);
        out[key] = JSON.parse(JSON.stringify(child));
      }
      continue;
    }
    out[key] = child;
  }
  return out;
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
  socialProofs: Record<string, unknown>[];
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

  const imageManifest = manifestRaw.map((item, index) => parseManifestItem(item, index));
  const socialRaw = Array.isArray(raw.socialProofs) ? raw.socialProofs : [];
  if (socialRaw.length > 3) {
    throw new InvalidTrustTransitionError("At most 3 social proofs");
  }
  const socialProofs = socialRaw.map((item, index) => parseSocialProof(item, index));

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
  for (const key of allowedTop) {
    if (raw[key] === undefined) continue;
    if (key === "credentialSubject") {
      out[key] = pickAllowedObject(raw[key], CREDENTIAL_SUBJECT_KEYS, "credentialSubject");
      continue;
    }
    if (key === "proof") {
      out[key] = pickAllowedObject(raw[key], PROOF_KEYS, "proof");
      continue;
    }
    if (key === "credentialStatus" && raw[key] && typeof raw[key] === "object") {
      const status = assertPlainObject(raw[key], "credentialStatus");
      rejectBinaryShaped(status, "credentialStatus");
      out[key] = {
        id: typeof status.id === "string" ? status.id.slice(0, 240) : undefined,
        type: typeof status.type === "string" ? status.type.slice(0, 80) : undefined,
      };
      continue;
    }
    if (key === "@context" || key === "type") {
      if (Array.isArray(raw[key])) {
        out[key] = raw[key]
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.slice(0, 240));
      } else if (typeof raw[key] === "string") {
        out[key] = raw[key].slice(0, 240);
      }
      continue;
    }
    if (typeof raw[key] === "string") {
      out[key] = raw[key].slice(0, 500);
    }
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
