import type { TrustEventEnvelope } from "./types.ts";
import { canonicalize, sha256Hex } from "./portable/canonicalize.ts";
import { requireMatchingRegistryKeypair } from "./portable/keypair-guard.ts";
import { signCanonical } from "./portable/keys.ts";

/** Create a cryptographically signed, hash-chained trust event (never unsigned:). */
export async function buildSignedTrustEvent(input: {
  eventId: string;
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
  priorEventHash?: string | null;
  schemaVersion?: number;
}): Promise<TrustEventEnvelope> {
  const keys = await requireMatchingRegistryKeypair({
    REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
    NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
      process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
    NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
  });
  const payloadHash = await sha256Hex(canonicalize(input.payload));
  const body = {
    eventId: input.eventId,
    subjectProfileId: input.subjectProfileId,
    actorProfileId: input.actorProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    payloadHash,
    priorEventHash: input.priorEventHash ?? undefined,
    registryId: keys.registryId,
    schemaVersion: input.schemaVersion ?? 1,
  };
  const signature = await signCanonical(keys.privateKey, body);
  if (signature.startsWith("unsigned:")) {
    throw new Error("Refusing to publish unsigned trust event");
  }
  return { ...body, signature };
}
