import { and, eq } from "drizzle-orm";
import { getDb, type AppDb } from "../../db/index.ts";
import { trustEvents } from "../../db/schema.ts";
import { normalizePriorEventId } from "./prior-hash.ts";
import { buildSignedTrustEvent } from "./signed-events.ts";
import type { TrustEventEnvelope } from "./types.ts";

export {
  normalizePriorEventHash,
  normalizePriorEventId,
  priorForEnvelope,
} from "./prior-hash.ts";

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
  const priorEventId = normalizePriorEventId(
    envelope.priorEventId ?? envelope.priorEventHash,
  );
  return {
    id: envelope.eventId,
    subjectProfileId: envelope.subjectProfileId,
    actorProfileId: envelope.actorProfileId ?? null,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    payloadHash: envelope.payloadHash,
    // Preserve signed v1 prior_event_hash; v2 events leave it empty (link via prior_event_id).
    priorEventHash:
      envelope.schemaVersion >= 2
        ? ""
        : normalizePriorEventId(envelope.priorEventHash),
    priorEventId,
    registryId: envelope.registryId,
    schemaVersion: envelope.schemaVersion,
    signature: envelope.signature,
  };
}

/** Current chain tip event id for a subject ('' if genesis). */
export async function loadChainTipEventId(
  db: AppDb,
  subjectProfileId: string,
): Promise<string> {
  const subjectRows = await db
    .select({
      id: trustEvents.id,
      priorEventId: trustEvents.priorEventId,
    })
    .from(trustEvents)
    .where(eq(trustEvents.subjectProfileId, subjectProfileId));
  if (!subjectRows.length) return "";
  const referenced = new Set(
    subjectRows
      .map((r) => r.priorEventId)
      .filter((p): p is string => Boolean(p && p.length > 0)),
  );
  const tips = subjectRows.filter((r) => !referenced.has(r.id));
  if (tips.length > 1) {
    throw new Error(`Forked trust event chain for subject ${subjectProfileId}`);
  }
  return normalizePriorEventId(tips[0]?.id);
}

/** Sign a chain-linked trust event against the current tip (no DB write). */
export async function prepareSignedTrustEvent(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
  db?: AppDb;
  /** When chaining multiple new events in memory, pass the prior tip event id. */
  priorEventId?: string;
}): Promise<TrustEventEnvelope> {
  const db = input.db ?? (await getDb());
  const priorEventId =
    input.priorEventId !== undefined
      ? normalizePriorEventId(input.priorEventId)
      : await loadChainTipEventId(db, input.subjectProfileId);
  return buildSignedTrustEvent({
    eventId: crypto.randomUUID(),
    subjectProfileId: input.subjectProfileId,
    actorProfileId: input.actorProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
    priorEventId: priorEventId || null,
  });
}

/**
 * Prepare a contiguous chain of signed events for one subject (in memory).
 * Does not write. Caller must batch-insert in order.
 */
export async function prepareSignedTrustEventChain(input: {
  subjectProfileId: string;
  db?: AppDb;
  events: Array<{
    actorProfileId?: string;
    eventType: string;
    occurredAt?: string;
    payload: unknown;
  }>;
}): Promise<TrustEventEnvelope[]> {
  const db = input.db ?? (await getDb());
  let prior = await loadChainTipEventId(db, input.subjectProfileId);
  const out: TrustEventEnvelope[] = [];
  for (const spec of input.events) {
    const envelope = await prepareSignedTrustEvent({
      subjectProfileId: input.subjectProfileId,
      actorProfileId: spec.actorProfileId,
      eventType: spec.eventType,
      occurredAt: spec.occurredAt,
      payload: spec.payload,
      db,
      priorEventId: prior,
    });
    out.push(envelope);
    prior = envelope.eventId;
  }
  return out;
}

/**
 * Append a signed, envelope-linked trust event.
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
 * Sign a chain first, then run one D1 batch that must include every event insert
 * plus any state/projection writes. Retries the whole unit on UNIQUE conflict.
 */
export async function commitAtomicTrustBatch<T>(input: {
  /** Per-subject event specs; prepared and chain-linked before the batch. */
  subjectEvents: Array<{
    subjectProfileId: string;
    events: Array<{
      actorProfileId?: string;
      eventType: string;
      occurredAt?: string;
      payload: unknown;
    }>;
  }>;
  run: (args: {
    db: AppDb;
    envelopesBySubject: Map<string, TrustEventEnvelope[]>;
    eventInserts: Array<ReturnType<AppDb["insert"]> extends never ? never : unknown>;
  }) => Promise<T>;
}): Promise<{ result: T; envelopesBySubject: Map<string, TrustEventEnvelope[]> }> {
  const db = await getDb();
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    const envelopesBySubject = new Map<string, TrustEventEnvelope[]>();
    const eventInserts: unknown[] = [];
    try {
      for (const group of input.subjectEvents) {
        const envelopes = await prepareSignedTrustEventChain({
          subjectProfileId: group.subjectProfileId,
          db,
          events: group.events,
        });
        envelopesBySubject.set(group.subjectProfileId, envelopes);
        for (const envelope of envelopes) {
          eventInserts.push(
            db.insert(trustEvents).values(trustEventInsertValues(envelope)),
          );
        }
      }
      const result = await input.run({ db, envelopesBySubject, eventInserts });
      return { result, envelopesBySubject };
    } catch (error) {
      lastError = error;
      if (!isUniqueConflict(error)) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to commit atomic trust batch without forking the chain");
}

/** @deprecated Prefer commitAtomicTrustBatch for multi-statement units. */
export async function commitWithSignedTrustEvent<T>(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
  run: (args: {
    db: AppDb;
    envelope: TrustEventEnvelope;
    eventInsert: { then?: unknown };
  }) => Promise<T>;
}): Promise<{ result: T; envelope: TrustEventEnvelope }> {
  const { result, envelopesBySubject } = await commitAtomicTrustBatch({
    subjectEvents: [
      {
        subjectProfileId: input.subjectProfileId,
        events: [
          {
            actorProfileId: input.actorProfileId,
            eventType: input.eventType,
            occurredAt: input.occurredAt,
            payload: input.payload,
          },
        ],
      },
    ],
    run: async ({ db, envelopesBySubject, eventInserts }) => {
      const envelope = envelopesBySubject.get(input.subjectProfileId)![0]!;
      return input.run({
        db,
        envelope,
        eventInsert: eventInserts[0] as { then?: unknown },
      });
    },
  });
  return {
    result,
    envelope: envelopesBySubject.get(input.subjectProfileId)![0]!,
  };
}

/** True when eventId is the sole chain tip for the subject. */
export async function isChainTipEvent(
  db: AppDb,
  subjectProfileId: string,
  eventId: string,
): Promise<boolean> {
  const tip = await loadChainTipEventId(db, subjectProfileId);
  return tip === eventId;
}

export async function assertNoSuccessor(
  db: AppDb,
  subjectProfileId: string,
  eventId: string,
): Promise<boolean> {
  const [child] = await db
    .select({ id: trustEvents.id })
    .from(trustEvents)
    .where(
      and(
        eq(trustEvents.subjectProfileId, subjectProfileId),
        eq(trustEvents.priorEventId, eventId),
      ),
    )
    .limit(1);
  return !child;
}
