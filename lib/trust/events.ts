import type { TrustEventEnvelope } from "./types.ts";
import { canonicalize, sha256Hex } from "./portable/canonicalize.ts";
import { signCanonical, type RegistryKeyPair } from "./portable/keys.ts";

export type TrustEventStore = {
  append(event: Omit<TrustEventEnvelope, "payloadHash" | "priorEventHash" | "signature"> & {
    payload: unknown;
    priorEventHash?: string;
  }): Promise<TrustEventEnvelope> | TrustEventEnvelope;
  listForSubject(subjectProfileId: string): TrustEventEnvelope[];
};

/** Legacy non-crypto digest kept for unsigned local fixtures. */
function legacyHashPayload(payload: unknown): string {
  const input = JSON.stringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x01000193) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}${input.length.toString(16)}`;
}

/** In-memory append-only store for domain tests and local fixtures. */
export function createMemoryTrustEventStore(
  registryId = "open-marketplace-local",
  signer?: Pick<RegistryKeyPair, "privateKey" | "keyId">,
): TrustEventStore {
  const events: TrustEventEnvelope[] = [];

  return {
    append(input) {
      const prior =
        input.priorEventHash ??
        events.filter((e) => e.subjectProfileId === input.subjectProfileId).at(-1)
          ?.payloadHash;

      if (signer) {
        return (async () => {
          const payloadHash = await sha256Hex(canonicalize(input.payload));
          const body = {
            eventId: input.eventId,
            subjectProfileId: input.subjectProfileId,
            actorProfileId: input.actorProfileId,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            payloadHash,
            priorEventHash: prior,
            registryId: input.registryId ?? registryId,
            schemaVersion: input.schemaVersion,
          };
          const signature = await signCanonical(signer.privateKey, body);
          const envelope: TrustEventEnvelope = { ...body, signature };
          events.push(envelope);
          return envelope;
        })();
      }

      const payloadHash = legacyHashPayload(input.payload);
      const envelope: TrustEventEnvelope = {
        eventId: input.eventId,
        subjectProfileId: input.subjectProfileId,
        actorProfileId: input.actorProfileId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        payloadHash,
        priorEventHash: prior,
        registryId: input.registryId ?? registryId,
        schemaVersion: input.schemaVersion,
        signature: `unsigned:${payloadHash.slice(0, 16)}`,
      };
      events.push(envelope);
      return envelope;
    },
    listForSubject(subjectProfileId) {
      return events.filter((e) => e.subjectProfileId === subjectProfileId);
    },
  };
}
