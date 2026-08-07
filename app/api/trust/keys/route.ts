import {
  PortableTrustError,
  requireMatchingRegistryKeypair,
} from "../../../../lib/trust/portable/index.ts";

/** Publish the registry verification JWK only — never the private key. */
export async function GET() {
  try {
    const keys = await requireMatchingRegistryKeypair({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });
    return Response.json({
      registryId: keys.registryId,
      keyId: keys.keyId,
      publicJwk: keys.publicJwk,
      disclosures: [
        "This endpoint returns the verification key only.",
        "Private signing material never leaves the server environment.",
        "Startup refuses mismatched or missing registry keypairs.",
      ],
    });
  } catch (error) {
    if (error instanceof PortableTrustError) {
      return Response.json(
        { error: "registry_key_unavailable", message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: "registry_key_error", message }, { status: 500 });
  }
}
