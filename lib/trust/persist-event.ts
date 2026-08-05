import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { trustEvents } from "../../db/schema";
import { buildSignedTrustEvent } from "./signed-events.ts";
import type { TrustEventEnvelope } from "./types.ts";

/** Append a signed, hash-chained trust event for a subject profile. */
export async function appendSignedTrustEvent(input: {
  subjectProfileId: string;
  actorProfileId?: string;
  eventType: string;
  occurredAt?: string;
  payload: unknown;
}): Promise<TrustEventEnvelope> {
  const db = await getDb();
  const [prior] = await db
    .select({ payloadHash: trustEvents.payloadHash })
    .from(trustEvents)
    .where(eq(trustEvents.subjectProfileId, input.subjectProfileId))
    .orderBy(desc(trustEvents.occurredAt))
    .limit(1);

  const envelope = await buildSignedTrustEvent({
    eventId: crypto.randomUUID(),
    subjectProfileId: input.subjectProfileId,
    actorProfileId: input.actorProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload,
    priorEventHash: prior?.payloadHash ?? null,
  });

  await db.insert(trustEvents).values({
    id: envelope.eventId,
    subjectProfileId: envelope.subjectProfileId,
    actorProfileId: envelope.actorProfileId ?? null,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    payloadHash: envelope.payloadHash,
    priorEventHash: envelope.priorEventHash ?? null,
    registryId: envelope.registryId,
    schemaVersion: envelope.schemaVersion,
    signature: envelope.signature,
  });

  return envelope;
}
