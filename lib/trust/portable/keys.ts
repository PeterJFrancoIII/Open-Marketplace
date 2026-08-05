import { canonicalize, sha256Hex } from "./canonicalize.ts";

export type RegistryKeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
  keyId: string;
};

export class PortableTrustError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PortableTrustError";
    this.status = status;
  }
}

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

export async function generateRegistryKeyPair(): Promise<RegistryKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keyId = await sha256Hex(canonicalize({ kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y }));
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    privateJwk,
    publicJwk: { ...publicJwk, kid: keyId.slice(0, 16) },
    keyId: keyId.slice(0, 16),
  };
}

export async function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

export async function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}

export async function signCanonical(
  privateKey: CryptoKey,
  payload: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(payload));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    bytes,
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function verifyCanonical(
  publicKey: CryptoKey,
  payload: unknown,
  signature: string,
): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(canonicalize(payload));
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlToBytes(signature),
      bytes,
    );
  } catch {
    return false;
  }
}

export function parseJwkEnv(raw: string | undefined | null): JsonWebKey | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as JsonWebKey;
    if (parsed.kty !== "EC" || parsed.crv !== "P-256") {
      throw new PortableTrustError("Registry signing key must be EC P-256 JWK", 503);
    }
    return parsed;
  } catch (error) {
    if (error instanceof PortableTrustError) throw error;
    throw new PortableTrustError("Invalid registry signing JWK in environment", 503);
  }
}

export async function loadRegistrySignerFromEnv(env: {
  REGISTRY_SIGNING_PRIVATE_JWK?: string | null;
  NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK?: string | null;
  NEXT_PUBLIC_REGISTRY_ID?: string | null;
}): Promise<{
  registryId: string;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  publicJwk: JsonWebKey | null;
  keyId: string | null;
}> {
  const registryId = env.NEXT_PUBLIC_REGISTRY_ID?.trim() || "open-marketplace-local";
  const privateJwk = parseJwkEnv(env.REGISTRY_SIGNING_PRIVATE_JWK);
  const publicJwk =
    parseJwkEnv(env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK) ??
    (privateJwk
      ? {
          kty: privateJwk.kty,
          crv: privateJwk.crv,
          x: privateJwk.x,
          y: privateJwk.y,
          kid: privateJwk.kid,
        }
      : null);

  const privateKey = privateJwk ? await importPrivateJwk(privateJwk) : null;
  const publicKey = publicJwk ? await importPublicJwk(publicJwk) : null;
  const keyId =
    (typeof publicJwk?.kid === "string" && publicJwk.kid) ||
    (publicJwk
      ? (
          await sha256Hex(
            canonicalize({ kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y }),
          )
        ).slice(0, 16)
      : null);

  return { registryId, privateKey, publicKey, publicJwk, keyId };
}
