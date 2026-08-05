import {
  PortableTrustError,
  rateLimit,
  requireMatchingRegistryKeypair,
  verifyBoundedClaim,
  verifyTrustBundle,
  type OpenMarketplaceVerifiableCredential,
  type TrustExportBundle,
} from "../../../../lib/trust";

function errorResponse(error: unknown) {
  if (error instanceof PortableTrustError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected verify error";
  return Response.json({ error: "verify_error", message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const limited = rateLimit({
      key: `trust:verify:${request.headers.get("cf-connecting-ip") ?? "anon"}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const signer = await requireMatchingRegistryKeypair({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });

    const body = (await request.json()) as {
      bundle?: TrustExportBundle;
      credential?: OpenMarketplaceVerifiableCredential;
      revokedCredentialIds?: string[];
    };

    const revoked = new Set(body.revokedCredentialIds ?? []);

    if (body.bundle) {
      const result = await verifyTrustBundle({
        bundle: body.bundle,
        publicKey: signer.publicKey,
        revokedCredentialIds: revoked,
      });
      return Response.json({
        kind: "bundle",
        ...result,
        disclosures: [
          "Verification checks signatures, expiry, and revocation ids only.",
          "External-labeled credentials are never native ratings.",
        ],
      });
    }

    if (body.credential) {
      const result = await verifyBoundedClaim({
        credential: body.credential,
        publicKey: signer.publicKey,
        revokedIds: revoked,
      });
      return Response.json({
        kind: "credential",
        ...result,
        evidenceLabel: body.credential.credentialSubject.evidenceLabel,
        disclosures: [
          "External evidence remains separately labeled after verification.",
        ],
      });
    }

    return Response.json(
      { error: "Provide bundle or credential to verify" },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
