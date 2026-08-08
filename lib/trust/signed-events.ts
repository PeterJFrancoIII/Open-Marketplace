import type { TrustEventEnvelope } from "./types.ts";
import { TRUST_ENVELOPE_SCHEMA_CURRENT } from "./types.ts";
import { priorForEnvelope } from "./prior-hash.ts";
import { canonicalize, sha256Hex } from "./portable/canonicalize.ts";
import { requireMatchingRegistryKeypair } from "./portable/keypair-guard.ts";
import { signCanonical } from "./portable/keys.ts";

/** Create a cryptographically signed, id-linked trust event (schema v2). */
export async function buildSignedTrustEvent(input: {
  eventId: string;
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
  /** Prior event id; null/undefined/'' = genesis. */
  priorEventHash?: string | null;
  priorEventId?: string | null;
  schemaVersion?: number;
}): Promise<TrustEventEnvelope> {
  const keys = await requireMatchingRegistryKeypair({
    REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
    NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
      process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
    NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
  });
  const payloadHash = await sha256Hex(canonicalize(input.payload));
  const schemaVersion = input.schemaVersion ?? TRUST_ENVELOPE_SCHEMA_CURRENT;
  const priorEventId = priorForEnvelope(
    input.priorEventId ?? input.priorEventHash,
  );

  const body = {
    eventId: input.eventId,
    subjectProfileId: input.subjectProfileId,
    actorProfileId: input.actorProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    payloadHash,
    priorEventId,
    registryId: keys.registryId,
    schemaVersion,
  };

  const signature = await signCanonical(keys.privateKey, body);
  if (signature.startsWith("unsigned:")) {
    throw new Error("Refusing to publish unsigned trust event");
  }
  return { ...body, signature };
}
