import { PROJECTION_VERSION } from "../projections.ts";
import { canonicalize, sha256Hex } from "./canonicalize.ts";
import {
  PortableTrustError,
  signCanonical,
  verifyCanonical,
} from "./keys.ts";

export type BoundedClaimType =
  | "sellerCompletedTransactions"
  | "sellerAggregateRating"
  | "buyerAggregateRating"
  | "providerConnectionControlled"
  | "memberSince";

export type CredentialStatus = {
  type: "OpenMarketplaceCredentialStatus2026";
  statusPurpose: "revocation";
  status: "valid" | "revoked" | "expired";
  statusListIndex?: string;
};

export type OpenMarketplaceVerifiableCredential = {
  "@context": string[];
  type: string[];
  id: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  credentialSubject: {
    id: string;
    claimType: BoundedClaimType;
    value: string | number;
    unit?: string;
    registryId: string;
    algorithmVersion?: string;
    sampleSize?: number;
    evidenceLabel: "native_registry" | "external";
    notes?: string;
  };
  credentialStatus: CredentialStatus;
  proof?: {
    type: "DataIntegrityProof";
    cryptosuite: "ecdsa-jcs-2019";
    created: string;
    verificationMethod: string;
    proofPurpose: "assertionMethod";
    proofValue: string;
  };
};

export type ClaimInput = {
  profileId: string;
  claimType: BoundedClaimType;
  value: string | number;
  unit?: string;
  sampleSize?: number;
  algorithmVersion?: string;
  notes?: string;
  evidenceLabel?: "native_registry" | "external";
  validFrom?: Date;
  /** Default 365 days. */
  ttlDays?: number;
};

function issuerDid(registryId: string, keyId: string): string {
  return `did:web:${registryId.replace(/[^a-zA-Z0-9.-]/g, "_")}#${keyId}`;
}

function subjectId(profileId: string): string {
  return `urn:open-marketplace:profile:${profileId}`;
}

function withoutProof(
  vc: OpenMarketplaceVerifiableCredential,
): Omit<OpenMarketplaceVerifiableCredential, "proof"> {
  const rest = { ...vc };
  delete rest.proof;
  return rest;
}

export async function issueBoundedClaim(input: {
  claim: ClaimInput;
  registryId: string;
  privateKey: CryptoKey;
  keyId: string;
  now?: Date;
}): Promise<OpenMarketplaceVerifiableCredential> {
  if (input.claim.evidenceLabel === "external") {
    throw new PortableTrustError(
      "Native issuer cannot mint external-labeled claims; import them separately",
    );
  }
  const now = input.now ?? new Date();
  const validFrom = input.claim.validFrom ?? now;
  const ttlDays = input.claim.ttlDays ?? 365;
  const validUntil = new Date(validFrom.getTime() + ttlDays * 86_400_000);
  const idSeed = await sha256Hex(
    canonicalize({
      profileId: input.claim.profileId,
      claimType: input.claim.claimType,
      value: input.claim.value,
      validFrom: validFrom.toISOString(),
    }),
  );

  const unsigned: OpenMarketplaceVerifiableCredential = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://open-marketplace.local/ns/trust/v1",
    ],
    type: ["VerifiableCredential", "OpenMarketplaceTrustClaim"],
    id: `urn:uuid:${idSeed.slice(0, 32)}`,
    issuer: issuerDid(input.registryId, input.keyId),
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    credentialSubject: {
      id: subjectId(input.claim.profileId),
      claimType: input.claim.claimType,
      value: input.claim.value,
      unit: input.claim.unit,
      registryId: input.registryId,
      algorithmVersion: input.claim.algorithmVersion ?? PROJECTION_VERSION,
      sampleSize: input.claim.sampleSize,
      evidenceLabel: "native_registry",
      notes: input.claim.notes,
    },
    credentialStatus: {
      type: "OpenMarketplaceCredentialStatus2026",
      statusPurpose: "revocation",
      status: "valid",
    },
  };

  const proofValue = await signCanonical(input.privateKey, withoutProof(unsigned));
  return {
    ...unsigned,
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "ecdsa-jcs-2019",
      created: now.toISOString(),
      verificationMethod: issuerDid(input.registryId, input.keyId),
      proofPurpose: "assertionMethod",
      proofValue,
    },
  };
}

export async function verifyBoundedClaim(input: {
  credential: OpenMarketplaceVerifiableCredential;
  publicKey: CryptoKey;
  now?: Date;
  revokedIds?: Set<string>;
}): Promise<{
  ok: boolean;
  status: CredentialStatus["status"];
  reasons: string[];
}> {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  if (!input.credential.proof?.proofValue) {
    return { ok: false, status: "revoked", reasons: ["missing proof"] };
  }
  const payload = withoutProof(input.credential);
  const sigOk = await verifyCanonical(
    input.publicKey,
    payload,
    input.credential.proof.proofValue,
  );
  if (!sigOk) reasons.push("invalid signature");

  if (Date.parse(input.credential.validFrom) > now.getTime()) {
    reasons.push("not yet valid");
  }
  let status: CredentialStatus["status"] = "valid";
  if (Date.parse(input.credential.validUntil) <= now.getTime()) {
    status = "expired";
    reasons.push("expired");
  }
  if (input.revokedIds?.has(input.credential.id)) {
    status = "revoked";
    reasons.push("revoked");
  }
  if (input.credential.credentialStatus.status === "revoked") {
    status = "revoked";
    reasons.push("credentialStatus revoked");
  }

  // External evidence must never be treated as native ratings by verifiers.
  if (input.credential.credentialSubject.evidenceLabel === "external") {
    reasons.push("external evidence — not a native registry rating");
  }

  const notYetValid = reasons.includes("not yet valid");
  const ok = sigOk && status === "valid" && !notYetValid;
  return {
    ok,
    status: ok ? "valid" : status === "valid" && !sigOk ? "revoked" : status,
    reasons,
  };
}

export function claimsFromTrustSnapshot(input: {
  profileId: string;
  memberSince: string;
  sellerCompletedSales: number;
  sellerDisplayMean: number | null;
  sellerRatingCount: number;
  buyerDisplayMean: number | null;
  buyerRatingCount: number;
  providerConnectedAt?: string | null;
}): ClaimInput[] {
  const claims: ClaimInput[] = [
    {
      profileId: input.profileId,
      claimType: "memberSince",
      value: input.memberSince,
    },
    {
      profileId: input.profileId,
      claimType: "sellerCompletedTransactions",
      value: input.sellerCompletedSales,
      unit: "count",
    },
  ];
  if (input.sellerDisplayMean != null && input.sellerRatingCount >= 3) {
    claims.push({
      profileId: input.profileId,
      claimType: "sellerAggregateRating",
      value: input.sellerDisplayMean,
      unit: "stars",
      sampleSize: input.sellerRatingCount,
      algorithmVersion: PROJECTION_VERSION,
    });
  }
  if (input.buyerDisplayMean != null && input.buyerRatingCount >= 3) {
    claims.push({
      profileId: input.profileId,
      claimType: "buyerAggregateRating",
      value: input.buyerDisplayMean,
      unit: "stars",
      sampleSize: input.buyerRatingCount,
      algorithmVersion: PROJECTION_VERSION,
    });
  }
  if (input.providerConnectedAt) {
    claims.push({
      profileId: input.profileId,
      claimType: "providerConnectionControlled",
      value: input.providerConnectedAt,
      notes: "Control of provider account at connection time only",
    });
  }
  return claims;
}

/** Reject export payloads that include forbidden private material. */
export function assertExportSafe(payload: unknown): void {
  const json = JSON.stringify(payload);
  // Match explicit JSON keys / known token prefixes — not arbitrary base64 (proofs).
  if (
    /"accessToken"\s*:|"refreshToken"\s*:|"code_verifier"\s*:|"disputeEvidence"\s*:|"reviewBody"\s*:|"deviceFingerprint"\s*:|"body"\s*:\s*"[^"]{20,}"/i.test(
      json,
    )
  ) {
    throw new PortableTrustError(
      "Export refused: private review text, tokens, fingerprints, or dispute evidence must not leave the registry",
      500,
    );
  }
}
