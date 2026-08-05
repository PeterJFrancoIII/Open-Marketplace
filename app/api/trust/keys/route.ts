import { loadRegistrySignerFromEnv } from "../../../../lib/trust";

/** Publish the registry verification JWK only — never the private key. */
export async function GET() {
  try {
    const signer = await loadRegistrySignerFromEnv({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });
    if (!signer.publicJwk) {
      return Response.json(
        {
          error: "registry_key_unavailable",
          message: "No registry public verification key is configured.",
        },
        { status: 503 },
      );
    }
    return Response.json({
      registryId: signer.registryId,
      keyId: signer.keyId,
      publicJwk: {
        kty: signer.publicJwk.kty,
        crv: signer.publicJwk.crv,
        x: signer.publicJwk.x,
        y: signer.publicJwk.y,
        kid: signer.keyId,
      },
      disclosures: [
        "This endpoint returns the verification key only.",
        "Private signing material never leaves the server environment.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: "registry_key_error", message }, { status: 500 });
  }
}
