import type { OpenMarketplaceVerifiableCredential } from "./claims.ts";
import { PortableTrustError } from "./keys.ts";

/**
 * External claims are stored/displayed as separately labeled evidence.
 * They must never be folded into native seller/buyer rating aggregates.
 */
export type ExternalTrustEvidence = {
  id: string;
  profileId: string;
  sourceLabel: string;
  issuer: string;
  claimType: string;
  value: string | number;
  evidenceLabel: "external";
  credentialId: string;
  validFrom: string;
  validUntil: string;
  importedAt: string;
  status: "valid" | "expired" | "revoked" | "unverified";
  rawCredentialJson: string;
};

export function importExternalCredential(input: {
  id: string;
  profileId: string;
  sourceLabel: string;
  credential: OpenMarketplaceVerifiableCredential;
  now?: Date;
  signatureVerified?: boolean;
}): ExternalTrustEvidence {
  if (input.credential.credentialSubject.evidenceLabel !== "external") {
    // Force external labeling even if a foreign issuer omitted it.
  }
  const subjectId = input.credential.credentialSubject.id;
  const expected = `urn:open-marketplace:profile:${input.profileId}`;
  if (subjectId !== expected && !subjectId.includes(input.profileId)) {
    throw new PortableTrustError(
      "External credential subject does not match the target profile",
    );
  }

  const now = input.now ?? new Date();
  let status: ExternalTrustEvidence["status"] = "unverified";
  if (input.signatureVerified) {
    status =
      Date.parse(input.credential.validUntil) <= now.getTime() ? "expired" : "valid";
  }
  if (input.credential.credentialStatus.status === "revoked") {
    status = "revoked";
  }

  return {
    id: input.id,
    profileId: input.profileId,
    sourceLabel: input.sourceLabel.slice(0, 80) || "external",
    issuer: input.credential.issuer,
    claimType: input.credential.credentialSubject.claimType,
    value: input.credential.credentialSubject.value,
    evidenceLabel: "external",
    credentialId: input.credential.id,
    validFrom: input.credential.validFrom,
    validUntil: input.credential.validUntil,
    importedAt: now.toISOString(),
    status,
    rawCredentialJson: JSON.stringify(input.credential),
  };
}

/** Guard: native projection rebuilders must ignore external evidence. */
export function assertNotUsedAsNativeRating(evidence: ExternalTrustEvidence): void {
  if (evidence.evidenceLabel !== "external") {
    throw new PortableTrustError("Expected external evidence label");
  }
}

export function publicExternalEvidenceView(evidence: ExternalTrustEvidence): {
  id: string;
  sourceLabel: string;
  issuer: string;
  claimType: string;
  value: string | number;
  evidenceLabel: "external";
  status: ExternalTrustEvidence["status"];
  validFrom: string;
  validUntil: string;
  importedAt: string;
} {
  return {
    id: evidence.id,
    sourceLabel: evidence.sourceLabel,
    issuer: evidence.issuer,
    claimType: evidence.claimType,
    value: evidence.value,
    evidenceLabel: "external",
    status: evidence.status,
    validFrom: evidence.validFrom,
    validUntil: evidence.validUntil,
    importedAt: evidence.importedAt,
  };
}
