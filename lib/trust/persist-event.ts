import { desc, eq } from "drizzle-orm";
import { getDb, type AppDb } from "../../db/index.ts";
import { trustEvents } from "../../db/schema.ts";
import { normalizePriorEventHash } from "./prior-hash.ts";
import { buildSignedTrustEvent } from "./signed-events.ts";
import type { TrustEventEnvelope } from "./types.ts";

export { normalizePriorEventHash } from "./prior-hash.ts";

const MAX_APPEND_ATTEMPTS = 8;

function isUniqueConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /UNIQUE constraint failed/i.test(message) ||
    /constraint failed/i.test(message) ||
    /trust_events_subject_prior/i.test(message)
  );
}

export function trustEventInsertValues(envelope: TrustEventEnvelope) {
  return {
    id: envelope.eventId,
    subjectProfileId: envelope.subjectProfileId,
    actorProfileId: envelope.actorProfileId ?? null,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    payloadHash: envelope.payloadHash,
    priorEventHash: normalizePriorEventHash(envelope.priorEventHash),
    registryId: envelope.registryId,
    schemaVersion: envelope.schemaVersion,
    signature: envelope.signature,
  };
}

async function loadPriorPayloadHash(
  db: AppDb,
  subjectProfileId: string,
): Promise<string> {
  const [prior] = await db
    .select({ payloadHash: trustEvents.payloadHash })
    .from(trustEvents)
    .where(eq(trustEvents.subjectProfileId, subjectProfileId))
    .orderBy(desc(trustEvents.occurredAt))
    .limit(1);
  return normalizePriorEventHash(prior?.payloadHash);
}

/** Sign a hash-chained trust event against the current tip (no DB write). */
export async function prepareSignedTrustEvent(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
  db?: AppDb;
}): Promise<TrustEventEnvelope> {
  const db = input.db ?? (await getDb());
  const priorEventHash = await loadPriorPayloadHash(db, input.subjectProfileId);
  return buildSignedTrustEvent({
    eventId: crypto.randomUUID(),
    subjectProfileId: input.subjectProfileId,
    actorProfileId: input.actorProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
    priorEventHash: priorEventHash || null,
  });
}

/**
 * Append a signed, hash-chained trust event.
 * Retries when a concurrent writer claims the same prior (UNIQUE conflict).
 */
export async function appendSignedTrustEvent(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
}): Promise<TrustEventEnvelope> {
  const db = await getDb();
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    const envelope = await prepareSignedTrustEvent({ ...input, db });
    try {
      await db.insert(trustEvents).values(trustEventInsertValues(envelope));
      return envelope;
    } catch (error) {
      lastError = error;
      if (!isUniqueConflict(error)) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to append trust event without forking the chain");
}

/**
 * Sign first, then run caller batch that must include the event insert.
 * On UNIQUE conflict, rebuild envelope and retry the whole batch.
 */
export async function commitWithSignedTrustEvent<T>(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
  run: (args: {
    db: AppDb;
    envelope: TrustEventEnvelope;
    eventInsert: {
      // Drizzle D1 batch accepts thenable query builders.
      then?: unknown;
    };
  }) => Promise<T>;
}): Promise<{ result: T; envelope: TrustEventEnvelope }> {
  const db = await getDb();
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    const envelope = await prepareSignedTrustEvent({
      subjectProfileId: input.subjectProfileId,
      actorProfileId: input.actorProfileId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      payload: input.payload,
      db,
    });
    try {
      const eventInsert = db
        .insert(trustEvents)
        .values(trustEventInsertValues(envelope));
      const result = await input.run({ db, envelope, eventInsert });
      return { result, envelope };
    } catch (error) {
      lastError = error;
      if (!isUniqueConflict(error)) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to commit trust mutation without forking the chain");
}
