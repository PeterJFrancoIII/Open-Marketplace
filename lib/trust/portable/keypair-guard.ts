import { importPrivateJwk, importPublicJwk, PortableTrustError } from "./keys.ts";
import { signCanonical, verifyCanonical } from "./keys.ts";

export type ValidatedRegistryKeys = {
  registryId: string;
  keyId: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
};

/**
 * Fail closed unless configured private/public JWKs are one matching P-256 pair.
 */
export async function requireMatchingRegistryKeypair(env: {
  REGISTRY_SIGNING_PRIVATE_JWK?: string | null;
  NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK?: string | null;
  NEXT_PUBLIC_REGISTRY_ID?: string | null;
}): Promise<ValidatedRegistryKeys> {
  const registryId = env.NEXT_PUBLIC_REGISTRY_ID?.trim() || "open-marketplace-local";
  const privateRaw = env.REGISTRY_SIGNING_PRIVATE_JWK?.trim();
  const publicRaw = env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK?.trim();
  if (!privateRaw || !publicRaw) {
    throw new PortableTrustError(
      "REGISTRY_SIGNING_PRIVATE_JWK and NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK are required",
      503,
    );
  }

  let privateJwk: JsonWebKey;
  let publicJwk: JsonWebKey;
  try {
    privateJwk = JSON.parse(privateRaw) as JsonWebKey;
    publicJwk = JSON.parse(publicRaw) as JsonWebKey;
  } catch {
    throw new PortableTrustError("Registry JWKs must be valid JSON", 503);
  }

  if (privateJwk.kty !== "EC" || privateJwk.crv !== "P-256" || !privateJwk.d) {
    throw new PortableTrustError("Private JWK must be EC P-256 with d", 503);
  }
  if (publicJwk.kty !== "EC" || publicJwk.crv !== "P-256" || !publicJwk.x || !publicJwk.y) {
    throw new PortableTrustError("Public JWK must be EC P-256 with x/y", 503);
  }
  if (privateJwk.x !== publicJwk.x || privateJwk.y !== publicJwk.y) {
    throw new PortableTrustError("Registry private/public JWKs are not the same keypair", 503);
  }

  const privateKey = await importPrivateJwk(privateJwk);
  const publicKey = await importPublicJwk(publicJwk);
  const probe = { t: "om-keypair-probe", n: 1 };
  const signature = await signCanonical(privateKey, probe);
  const ok = await verifyCanonical(publicKey, probe, signature);
  if (!ok) {
    throw new PortableTrustError("Registry keypair failed sign/verify probe", 503);
  }

  const keyId =
    (typeof publicJwk.kid === "string" && publicJwk.kid) ||
    `${publicJwk.x?.slice(0, 8) ?? "key"}`;

  return {
    registryId,
    keyId,
    privateKey,
    publicKey,
    publicJwk: {
      kty: publicJwk.kty,
      crv: publicJwk.crv,
      x: publicJwk.x,
      y: publicJwk.y,
      kid: keyId,
    },
  };
}
