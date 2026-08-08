import type { TrustEventEnvelope } from "../types.ts";
import { TRUST_ENVELOPE_SCHEMA_V2 } from "../types.ts";
import { priorForEnvelope } from "../prior-hash.ts";
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

function eventPriorLink(event: TrustEventEnvelope): string | undefined {
  if (event.schemaVersion >= TRUST_ENVELOPE_SCHEMA_V2) {
    return priorForEnvelope(event.priorEventId);
  }
  return priorForEnvelope(event.priorEventHash);
}

function isChildOf(
  child: TrustEventEnvelope,
  parent: TrustEventEnvelope,
): boolean {
  if (child.schemaVersion >= TRUST_ENVELOPE_SCHEMA_V2) {
    return priorForEnvelope(child.priorEventId) === parent.eventId;
  }
  return priorForEnvelope(child.priorEventHash) === parent.payloadHash;
}

function signedEventBody(envelope: TrustEventEnvelope) {
  if (envelope.schemaVersion >= TRUST_ENVELOPE_SCHEMA_V2) {
    return {
      eventId: envelope.eventId,
      subjectProfileId: envelope.subjectProfileId,
      actorProfileId: envelope.actorProfileId,
      eventType: envelope.eventType,
      occurredAt: envelope.occurredAt,
      payloadHash: envelope.payloadHash,
      priorEventId: priorForEnvelope(envelope.priorEventId),
      registryId: envelope.registryId,
      schemaVersion: envelope.schemaVersion,
    };
  }
  return {
    eventId: envelope.eventId,
    subjectProfileId: envelope.subjectProfileId,
    actorProfileId: envelope.actorProfileId,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    payloadHash: envelope.payloadHash,
    priorEventHash: priorForEnvelope(envelope.priorEventHash),
    registryId: envelope.registryId,
    schemaVersion: envelope.schemaVersion,
  };
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
    priorEventHash: priorForEnvelope(event.priorEventHash),
    priorEventId: priorForEnvelope(event.priorEventId),
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
  eventsValid: boolean;
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
  const events = input.bundle.events;
  const ids = events.map((e) => e.eventId);
  if (new Set(ids).size !== ids.length) {
    eventsValid = false;
    reasons.push("duplicate event ids in bundle");
  }

  for (const event of events) {
    if (event.subjectProfileId !== input.bundle.subjectProfileId) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} subject mismatch`);
    }
    if (event.registryId !== input.bundle.registryId) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} registry mismatch`);
    }
  }

  const byId = new Map(events.map((e) => [e.eventId, e]));
  const roots = events.filter((e) => !eventPriorLink(e));
  if (events.length > 0 && roots.length !== 1) {
    eventsValid = false;
    reasons.push(`expected exactly one root, found ${roots.length}`);
  }

  const ordered: typeof events = [];
  const seen = new Set<string>();
  const queue = [...roots].sort((a, b) => a.eventId.localeCompare(b.eventId));
  while (queue.length) {
    const event = queue.shift()!;
    if (seen.has(event.eventId)) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} appears twice in chain walk`);
      continue;
    }
    seen.add(event.eventId);
    ordered.push(event);
    const children = events
      .filter((e) => isChildOf(e, event))
      .sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (children.length > 1) {
      eventsValid = false;
      reasons.push(`event ${event.eventId} has multiple successors`);
    }
    queue.push(...children);
  }

  if (ordered.length !== events.length) {
    eventsValid = false;
    reasons.push("event chain is incomplete, forked, cyclic, or disconnected");
  }

  const tips = ordered.filter(
    (e) => !ordered.some((child) => child !== e && isChildOf(child, e)),
  );
  if (events.length > 0 && tips.length !== 1) {
    eventsValid = false;
    reasons.push(`expected exactly one tip, found ${tips.length}`);
  }

  for (const event of ordered) {
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
    const prior = eventPriorLink(event);
    if (prior) {
      if (event.schemaVersion >= TRUST_ENVELOPE_SCHEMA_V2) {
        if (!byId.has(prior)) {
          eventsValid = false;
          reasons.push(`event ${event.eventId} priorEventId missing from bundle`);
        }
      } else {
        const parent = events.find((e) => e.payloadHash === prior);
        if (!parent) {
          eventsValid = false;
          reasons.push(`event ${event.eventId} priorEventHash missing from bundle`);
        }
      }
    }
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
  priorEventId?: string;
  priorEventHash?: string;
}): Promise<TrustEventEnvelope> {
  const payloadHash = await sha256Hex(canonicalize(input.unsigned.payload));
  const schemaVersion =
    input.unsigned.schemaVersion ?? TRUST_ENVELOPE_SCHEMA_V2;
  const body =
    schemaVersion >= TRUST_ENVELOPE_SCHEMA_V2
      ? {
          eventId: input.unsigned.eventId,
          subjectProfileId: input.unsigned.subjectProfileId,
          actorProfileId: input.unsigned.actorProfileId,
          eventType: input.unsigned.eventType,
          occurredAt: input.unsigned.occurredAt,
          payloadHash,
          priorEventId: priorForEnvelope(
            input.priorEventId ?? input.unsigned.priorEventId,
          ),
          registryId: input.unsigned.registryId,
          schemaVersion,
        }
      : {
          eventId: input.unsigned.eventId,
          subjectProfileId: input.unsigned.subjectProfileId,
          actorProfileId: input.unsigned.actorProfileId,
          eventType: input.unsigned.eventType,
          occurredAt: input.unsigned.occurredAt,
          payloadHash,
          priorEventHash: priorForEnvelope(
            input.priorEventHash ?? input.unsigned.priorEventHash,
          ),
          registryId: input.unsigned.registryId,
          schemaVersion,
        };
  const signature = await signCanonical(input.privateKey, body);
  return { ...body, signature };
}

export async function verifyTrustEventEnvelope(input: {
  envelope: TrustEventEnvelope;
  publicKey: CryptoKey;
}): Promise<boolean> {
  const body = signedEventBody(input.envelope);
  return verifyCanonical(input.publicKey, body, input.envelope.signature);
}
