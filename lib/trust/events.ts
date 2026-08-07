import type { TrustEventEnvelope } from "./types.ts";

export type TrustEventStore = {
  append(event: Omit<TrustEventEnvelope, "payloadHash" | "priorEventHash" | "signature"> & {
    payload: unknown;
    priorEventHash?: string;
  }): Promise<TrustEventEnvelope> | TrustEventEnvelope;
  listForSubject(subjectProfileId: string): TrustEventEnvelope[];
};

type MemorySigner = {
  privateKey: CryptoKey;
  keyId?: string;
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
  signer?: MemorySigner,
): TrustEventStore {
  const events: TrustEventEnvelope[] = [];

  return {
    append(input) {
      const prior =
        input.priorEventHash ??
        events.filter((e) => e.subjectProfileId === input.subjectProfileId).at(-1)
          ?.eventId;

      if (signer) {
        return (async () => {
          const { canonicalize, sha256Hex } = await import("./portable/canonicalize.ts");
          const { signCanonical } = await import("./portable/keys.ts");
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
