/** Tiny in-isolate sliding-window rate limiter (near-zero cost). */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = input.now ?? Date.now();
  const bucket = buckets.get(input.key) ?? { timestamps: [] };
  const cutoff = now - input.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= input.limit) {
    buckets.set(input.key, bucket);
    const oldest = bucket.timestamps[0] ?? now;
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + input.windowMs - now),
    };
  }
  bucket.timestamps.push(now);
  buckets.set(input.key, bucket);
  return {
    ok: true,
    remaining: Math.max(0, input.limit - bucket.timestamps.length),
    retryAfterMs: 0,
  };
}

/** Test helper */
export function resetRateLimits(): void {
  buckets.clear();
}
