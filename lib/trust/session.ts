import { AuthError } from "./errors.ts";

const COOKIE_NAME = "om_session";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionClaims = {
  profileId: string;
  issuedAt: number;
  expiresAt: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function requireSessionSecret(raw?: string | null): string {
  const secret = raw?.trim() ?? "";
  if (secret.length < 32) {
    throw new AuthError(
      "SESSION_SECRET is missing or too short (min 32 chars). Protected mutations are disabled.",
      503,
    );
  }
  return secret;
}

export async function mintSessionToken(
  profileId: string,
  secret: string,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): Promise<string> {
  const claims: SessionClaims = {
    profileId,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<SessionClaims> {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new AuthError("Invalid session token");
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(sig),
    new TextEncoder().encode(body),
  );
  if (!ok) throw new AuthError("Invalid session signature");
  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionClaims;
  } catch {
    throw new AuthError("Invalid session payload");
  }
  if (!claims.profileId || claims.profileId.length < 8 || claims.profileId.length > 120) {
    throw new AuthError("Invalid session profile");
  }
  if (claims.expiresAt <= now) throw new AuthError("Session expired", 401);
  return claims;
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
    }
  }
  // Also accept Authorization: Session <token> for non-browser tests.
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("session ")) {
    return auth.slice("session ".length).trim();
  }
  return null;
}

export function sessionCookieHeader(
  token: string,
  maxAgeSeconds = DEFAULT_TTL_MS / 1000,
  options?: { secure?: boolean },
): string {
  // Secure cookies break plain http://localhost; allow opt-out for local/dev.
  const secure =
    options?.secure ??
    (process.env.SESSION_COOKIE_SECURE !== "0" &&
      process.env.NODE_ENV === "production");
  const securePart = secure ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}`;
}

export function clearSessionCookieHeader(options?: { secure?: boolean }): string {
  const secure =
    options?.secure ??
    (process.env.SESSION_COOKIE_SECURE !== "0" &&
      process.env.NODE_ENV === "production");
  const securePart = secure ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=0`;
}

export function newServerProfileId(): string {
  return `device:${crypto.randomUUID().replace(/-/g, "")}`;
}

export { COOKIE_NAME as SESSION_COOKIE_NAME };
