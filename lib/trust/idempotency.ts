/** Process-local idempotency map for Worker isolates / tests. */

type Entry = { fingerprint: string; body: unknown; status: number; storedAt: number };

const store = new Map<string, Entry>();
const TTL_MS = 24 * 60 * 60 * 1000;

export function rememberIdempotent(input: {
  key: string;
  fingerprint: string;
  body: unknown;
  status: number;
  now?: number;
}): void {
  const now = input.now ?? Date.now();
  store.set(input.key, {
    fingerprint: input.fingerprint,
    body: input.body,
    status: input.status,
    storedAt: now,
  });
}

export function recallIdempotent(input: {
  key: string;
  fingerprint: string;
  now?: number;
}): { hit: false } | { hit: true; conflict: boolean; body: unknown; status: number } {
  const now = input.now ?? Date.now();
  const entry = store.get(input.key);
  if (!entry) return { hit: false };
  if (now - entry.storedAt > TTL_MS) {
    store.delete(input.key);
    return { hit: false };
  }
  if (entry.fingerprint !== input.fingerprint) {
    return { hit: true, conflict: true, body: entry.body, status: entry.status };
  }
  return { hit: true, conflict: false, body: entry.body, status: entry.status };
}

export function resetIdempotency(): void {
  store.clear();
}

export function fingerprintPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    h = Math.imul(h ^ raw.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(16);
}
