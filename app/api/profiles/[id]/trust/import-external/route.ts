import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { externalTrustClaims, profiles } from "../../../../../../db/schema";
import {
  AuthError,
  importExternalCredential,
  loadRegistrySignerFromEnv,
  parseActor,
  PortableTrustError,
  publicExternalEvidenceView,
  rateLimit,
  verifyBoundedClaim,
  type OpenMarketplaceVerifiableCredential,
} from "../../../../../../lib/trust";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof PortableTrustError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  return Response.json({ error: "import_error", message }, { status: 500 });
}

export async function POST(request: Request, context: Params) {
  try {
    const { id: profileId } = await context.params;
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    if (actor.profileId !== profileId && !actor.isModerator) {
      return Response.json(
        { error: "Only the profile owner or a moderator may import external claims" },
        { status: 403 },
      );
    }

    const limited = rateLimit({
      key: `trust:import-external:${actor.profileId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json()) as {
      sourceLabel?: string;
      credential?: OpenMarketplaceVerifiableCredential;
    };
    if (!body.credential) {
      return Response.json({ error: "credential is required" }, { status: 400 });
    }

    // Force external label so foreign credentials cannot impersonate native ratings.
    const credential: OpenMarketplaceVerifiableCredential = {
      ...body.credential,
      credentialSubject: {
        ...body.credential.credentialSubject,
        evidenceLabel: "external",
      },
    };

    let signatureVerified = false;
    const signer = await loadRegistrySignerFromEnv({
      REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
      NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
        process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
      NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
    });
    if (signer.publicKey && credential.proof?.proofValue) {
      const verified = await verifyBoundedClaim({
        credential,
        publicKey: signer.publicKey,
      });
      // Foreign issuer keys are out of scope for PR 7; our public key match is best-effort.
      signatureVerified = verified.ok;
    }

    const evidence = importExternalCredential({
      id: `ext_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      profileId,
      sourceLabel: body.sourceLabel ?? "external",
      credential,
      signatureVerified,
    });

    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db
      .insert(profiles)
      .values({
        id: profileId,
        displayName: `User ${profileId.slice(0, 8)}`,
        updatedAt,
      })
      .onConflictDoUpdate({ target: profiles.id, set: { updatedAt } });

    await db
      .insert(externalTrustClaims)
      .values({
        id: evidence.id,
        profileId: evidence.profileId,
        sourceLabel: evidence.sourceLabel,
        issuer: evidence.issuer,
        claimType: evidence.claimType,
        valueJson: JSON.stringify(evidence.value),
        evidenceLabel: "external",
        credentialId: evidence.credentialId,
        status: evidence.status,
        validFrom: evidence.validFrom,
        validUntil: evidence.validUntil,
        rawCredentialJson: evidence.rawCredentialJson,
        importedAt: evidence.importedAt,
      })
      .onConflictDoUpdate({
        target: [externalTrustClaims.profileId, externalTrustClaims.credentialId],
        set: {
          sourceLabel: evidence.sourceLabel,
          issuer: evidence.issuer,
          claimType: evidence.claimType,
          valueJson: JSON.stringify(evidence.value),
          status: evidence.status,
          validFrom: evidence.validFrom,
          validUntil: evidence.validUntil,
          rawCredentialJson: evidence.rawCredentialJson,
          importedAt: evidence.importedAt,
        },
      });

    return Response.json(
      {
        evidence: publicExternalEvidenceView(evidence),
        disclosures: [
          "Imported as external evidence only.",
          "External claims never become native seller/buyer ratings.",
        ],
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request, context: Params) {
  try {
    const { id: profileId } = await context.params;
    parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const db = await getDb();
    const rows = await db
      .select()
      .from(externalTrustClaims)
      .where(eq(externalTrustClaims.profileId, profileId))
      .limit(50);

    return Response.json({
      evidence: rows.map((row) =>
        publicExternalEvidenceView({
          id: row.id,
          profileId: row.profileId,
          sourceLabel: row.sourceLabel,
          issuer: row.issuer,
          claimType: row.claimType,
          value: JSON.parse(row.valueJson) as string | number,
          evidenceLabel: "external",
          credentialId: row.credentialId,
          validFrom: row.validFrom,
          validUntil: row.validUntil,
          importedAt: row.importedAt,
          status: row.status as "valid" | "expired" | "revoked" | "unverified",
          rawCredentialJson: row.rawCredentialJson,
        }),
      ),
      disclosures: [
        "External evidence is listed separately from native registry ratings.",
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
