import type { TrustEventEnvelope } from "../types.ts";
import {
  assertExportSafe,
  claimsFromTrustSnapshot,
  issueBoundedClaim,
  type OpenMarketplaceVerifiableCredential,
  verifyBoundedClaim,
} from "./claims.ts";
import { canonicalize, sha256Hex } from "./canonicalize.ts";
import {
  PortableTrustError,
  signCanonical,
  verifyCanonical,
} from "./keys.ts";

export type TrustExportBundle = {
  type: "OpenMarketplaceTrustBundle";
  version: 1;
  registryId: string;
  subjectProfileId: string;
  exportedAt: string;
  events: TrustEventEnvelope[];
  credentials: OpenMarketplaceVerifiableCredential[];
  disclosures: string[];
  proof: {
    type: "DataIntegrityProof";
    cryptosuite: "ecdsa-jcs-2019";
    created: string;
    verificationMethod: string;
    proofPurpose: "assertionMethod";
    proofValue: string;
  };
};

function bundlePayload(bundle: TrustExportBundle) {
  const rest = { ...bundle };
  delete (rest as { proof?: TrustExportBundle["proof"] }).proof;
  return rest;
}

export async function buildSignedTrustBundle(input: {
  registryId: string;
  keyId: string;
  privateKey: CryptoKey;
  subjectProfileId: string;
  events: TrustEventEnvelope[];
  snapshot: {
    memberSince: string;
    sellerCompletedSales: number;
    sellerDisplayMean: number | null;
    sellerRatingCount: number;
    buyerDisplayMean: number | null;
    buyerRatingCount: number;
    providerConnectedAt?: string | null;
  };
  now?: Date;
}): Promise<TrustExportBundle> {
  const now = input.now ?? new Date();
  // Minimize: event envelopes only (hashes/types), never review bodies.
  const safeEvents = input.events.map((event) => ({
    eventId: event.eventId,
    subjectProfileId: event.subjectProfileId,
    actorProfileId: event.actorProfileId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payloadHash: event.payloadHash,
    priorEventHash: event.priorEventHash,
    registryId: event.registryId,
    schemaVersion: event.schemaVersion,
    signature: event.signature,
  }));

  const claimInputs = claimsFromTrustSnapshot({
    profileId: input.subjectProfileId,
    ...input.snapshot,
  });
  const credentials: OpenMarketplaceVerifiableCredential[] = [];
  for (const claim of claimInputs) {
    credentials.push(
      await issueBoundedClaim({
        claim,
        registryId: input.registryId,
        privateKey: input.privateKey,
        keyId: input.keyId,
        now,
      }),
    );
  }

  const unsigned: Omit<TrustExportBundle, "proof"> = {
    type: "OpenMarketplaceTrustBundle",
    version: 1,
    registryId: input.registryId,
    subjectProfileId: input.subjectProfileId,
    exportedAt: now.toISOString(),
    events: safeEvents,
    credentials,
    disclosures: [
      "Bounded claims only — not a universal trust score.",
      "Seller and buyer reputation remain separate.",
      "Private review text, social tokens, device fingerprints, and dispute evidence are omitted.",
      "External credentials must stay labeled external and never become native ratings.",
    ],
  };

  assertExportSafe(unsigned);
  const proofValue = await signCanonical(input.privateKey, unsigned);
  const bundle: TrustExportBundle = {
    ...unsigned,
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: "ecdsa-jcs-2019",
      created: now.toISOString(),
      verificationMethod: `did:web:${input.registryId.replace(/[^a-zA-Z0-9.-]/g, "_")}#${input.keyId}`,
      proofPurpose: "assertionMethod",
      proofValue,
    },
  };
  assertExportSafe(bundle);
  return bundle;
}

export async function verifyTrustBundle(input: {
  bundle: TrustExportBundle;
  publicKey: CryptoKey;
  now?: Date;
  revokedCredentialIds?: Set<string>;
}): Promise<{
  ok: boolean;
  bundleSignatureValid: boolean;
  credentials: Array<{
    id: string;
    claimType: string;
    evidenceLabel: string;
    ok: boolean;
    status: string;
    reasons: string[];
  }>;
  reasons: string[];
}> {
  if (input.bundle.type !== "OpenMarketplaceTrustBundle") {
    throw new PortableTrustError("Unsupported trust bundle type");
  }
  const bundleSignatureValid = await verifyCanonical(
    input.publicKey,
    bundlePayload(input.bundle),
    input.bundle.proof.proofValue,
  );
  const reasons: string[] = [];
  if (!bundleSignatureValid) reasons.push("bundle signature invalid");

  const credentials = [];
  for (const credential of input.bundle.credentials) {
    const result = await verifyBoundedClaim({
      credential,
      publicKey: input.publicKey,
      now: input.now,
      revokedIds: input.revokedCredentialIds,
    });
    credentials.push({
      id: credential.id,
      claimType: credential.credentialSubject.claimType,
      evidenceLabel: credential.credentialSubject.evidenceLabel,
      ok: result.ok,
      status: result.status,
      reasons: result.reasons,
    });
    if (!result.ok && credential.credentialSubject.evidenceLabel === "native_registry") {
      reasons.push(`credential ${credential.id} failed verification`);
    }
  }

  let eventsValid = true;
  let priorHash: string | undefined;
  const sortedEvents = [...input.bundle.events].sort((a, b) =>
    a.occurredAt === b.occurredAt
      ? a.eventId.localeCompare(b.eventId)
      : a.occurredAt.localeCompare(b.occurredAt),
  );
  for (const event of sortedEvents) {
    if (!event.signature || event.signature.startsWith("unsigned:")) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} is unsigned`);
      continue;
    }
    const eventOk = await verifyTrustEventEnvelope({
      envelope: event,
      publicKey: input.publicKey,
    });
    if (!eventOk) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} signature invalid`);
    }
    if (priorHash && event.priorEventHash && event.priorEventHash !== priorHash) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} breaks hash chain`);
    }
    if (priorHash && !event.priorEventHash) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} missing priorEventHash`);
    }
    priorHash = event.payloadHash;
  }

  const nativeFailed = credentials.some(
    (c) => c.evidenceLabel === "native_registry" && !c.ok,
  );
  return {
    ok: bundleSignatureValid && !nativeFailed && eventsValid,
    bundleSignatureValid,
    eventsValid,
    credentials,
    reasons,
  };
}
export async function signTrustEventEnvelope(input: {
  unsigned: Omit<TrustEventEnvelope, "payloadHash" | "signature"> & {
    payload: unknown;
  };
  privateKey: CryptoKey;
  priorEventHash?: string;
}): Promise<TrustEventEnvelope> {
  const payloadHash = await sha256Hex(canonicalize(input.unsigned.payload));
  const body = {
    eventId: input.unsigned.eventId,
    subjectProfileId: input.unsigned.subjectProfileId,
    actorProfileId: input.unsigned.actorProfileId,
    eventType: input.unsigned.eventType,
    occurredAt: input.unsigned.occurredAt,
    payloadHash,
    priorEventHash: input.priorEventHash ?? input.unsigned.priorEventHash,
    registryId: input.unsigned.registryId,
    schemaVersion: input.unsigned.schemaVersion,
  };
  const signature = await signCanonical(input.privateKey, body);
  return { ...body, signature };
}

export async function verifyTrustEventEnvelope(input: {
  envelope: TrustEventEnvelope;
  publicKey: CryptoKey;
}): Promise<boolean> {
  const { signature, ...body } = input.envelope;
  return verifyCanonical(input.publicKey, body, signature);
}
