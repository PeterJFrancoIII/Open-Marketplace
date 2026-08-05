import type { EncryptedProviderGrant, ProviderTokenBundle } from "./types.ts";
import { OAuthError } from "./types.ts";

const KID = "v1";
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Accept 32-byte raw key as hex (64 chars) or base64. */
export function parseEncryptionKey(raw: string | undefined | null): Uint8Array {
  if (!raw || !raw.trim()) {
    throw new OAuthError("OAUTH_TOKEN_ENCRYPTION_KEY is not configured", 503);
  }
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  try {
    const decoded = base64ToBytes(trimmed);
    if (decoded.length !== 32) {
      throw new OAuthError("OAUTH_TOKEN_ENCRYPTION_KEY must decode to 32 bytes", 503);
    }
    return decoded;
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    throw new OAuthError("OAUTH_TOKEN_ENCRYPTION_KEY is invalid", 503);
  }
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealTokenBundle(
  bundle: ProviderTokenBundle,
  encryptionKey: Uint8Array,
): Promise<EncryptedProviderGrant> {
  const key = await importAesKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    kid: KID,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function openTokenBundle(
  grant: EncryptedProviderGrant,
  encryptionKey: Uint8Array,
): Promise<ProviderTokenBundle> {
  if (grant.kid !== KID) {
    throw new OAuthError("Unsupported grant encryption kid", 500);
  }
  const key = await importAesKey(encryptionKey);
  const iv = base64ToBytes(grant.iv);
  const ciphertext = base64ToBytes(grant.ciphertext);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
    const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as ProviderTokenBundle;
    if (!parsed.accessToken || !parsed.providerSubject) {
      throw new OAuthError("Decrypted grant missing required fields", 500);
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tokenType: parsed.tokenType,
      expiresAt: parsed.expiresAt,
      providerSubject: parsed.providerSubject,
      grantedScopes: Array.isArray(parsed.grantedScopes) ? parsed.grantedScopes : [],
    };
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    throw new OAuthError("Failed to decrypt provider grant", 500);
  }
}

/** Hash provider subject for storage/indexes — never store raw subject next to grant id alone. */
export async function hashProviderSubject(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`om:provider-subject:${subject}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Redact token-like strings from objects before logging or client responses. */
export function assertNoSecretsInPublicPayload(value: unknown): void {
  const json = JSON.stringify(value);
  if (!json) return;
  if (
    /"accessToken"\s*:|"refreshToken"\s*:|"code_verifier"\s*:|ya29\.|EAA[A-Za-z0-9]|Bearer\s+[A-Za-z0-9._-]/i.test(
      json,
    )
  ) {
    throw new OAuthError("Refusing to expose provider secrets in a public payload", 500);
  }
}
