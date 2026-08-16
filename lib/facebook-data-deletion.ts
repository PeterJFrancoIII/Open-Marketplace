import { createHmac, timingSafeEqual } from "node:crypto";

const CONFIRMATION_PREFIX = "om-fb-del";

export type FacebookSignedRequest = {
  algorithm: string;
  user_id: string;
  issued_at?: number;
  expires?: number;
};

export type DeletionConfirmation = {
  confirmationCode: string;
  issuedAt: number;
};

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Buffer | null {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const decoded = Buffer.from(`${padded}${pad}`, "base64");
  return decoded.length > 0 ? decoded : null;
}

function hmacSha256(secret: string, value: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function equalBuffers(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseFacebookSignedRequest(
  signedRequest: string | null | undefined,
  appSecret: string,
): FacebookSignedRequest | null {
  if (!signedRequest || !appSecret) return null;
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const signature = base64UrlDecode(parts[0]);
  const payloadBytes = base64UrlDecode(parts[1]);
  if (!signature || !payloadBytes) return null;

  const expected = hmacSha256(appSecret, parts[1]);
  if (!equalBuffers(signature, expected)) return null;

  try {
    const payload = JSON.parse(payloadBytes.toString("utf8")) as {
      algorithm?: unknown;
      user_id?: unknown;
      issued_at?: unknown;
      expires?: unknown;
    };
    if (payload.algorithm !== "HMAC-SHA256") return null;
    if (typeof payload.user_id !== "string" || !payload.user_id.trim()) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    const issuedAt =
      typeof payload.issued_at === "number" ? payload.issued_at : undefined;
    const expires =
      typeof payload.expires === "number" ? payload.expires : undefined;
    if (expires != null && expires < now) return null;
    if (issuedAt != null && now - issuedAt > 24 * 60 * 60) return null;
    return {
      algorithm: "HMAC-SHA256",
      user_id: payload.user_id.trim(),
      issued_at: issuedAt,
      expires,
    };
  } catch {
    return null;
  }
}

export function createFacebookSignedRequest(
  payload: { user_id: string; issued_at?: number },
  appSecret: string,
): string {
  const encodedPayload = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        algorithm: "HMAC-SHA256",
        user_id: payload.user_id,
        issued_at: payload.issued_at ?? Math.floor(Date.now() / 1000),
      }),
      "utf8",
    ),
  );
  const signature = base64UrlEncode(hmacSha256(appSecret, encodedPayload));
  return `${signature}.${encodedPayload}`;
}

export function createDeletionConfirmation(
  issuedAt: number,
  secret: string,
): DeletionConfirmation {
  const mac = hmacSha256(secret, `${CONFIRMATION_PREFIX}:${issuedAt}`)
    .toString("hex")
    .slice(0, 20);
  return {
    confirmationCode: `${issuedAt}-${mac}`,
    issuedAt,
  };
}

export function verifyDeletionConfirmation(
  code: string | null | undefined,
  secret: string,
): DeletionConfirmation | null {
  if (!code || !secret) return null;
  const match = /^(\d{10,16})-([a-f0-9]{20})$/.exec(code.trim());
  if (!match) return null;
  const issuedAt = Number(match[1]);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) return null;
  const expected = createDeletionConfirmation(issuedAt, secret);
  const left = Buffer.from(code.trim(), "utf8");
  const right = Buffer.from(expected.confirmationCode, "utf8");
  if (!equalBuffers(left, right)) return null;
  return expected;
}

export function deletionStatusUrl(origin: string, confirmationCode: string): string {
  const url = new URL("/privacy/facebook-data-deletion/status", origin);
  url.searchParams.set("code", confirmationCode);
  return url.toString();
}
