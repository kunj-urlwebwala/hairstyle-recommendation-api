/**
 * Small in-memory sliding-window rate limiter.
 * Good enough for a single-process deployment; swap for a shared store if the
 * API ever runs as multiple instances.
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number, windowMs: number): Bucket {
  const cutoff = now - windowMs;
  let start = 0;
  while (start < bucket.length && bucket[start] <= cutoff) start++;
  return start > 0 ? bucket.slice(start) : bucket;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = prune(buckets.get(key) ?? [], now, windowMs);

  if (existing.length >= limit) {
    const oldest = existing[0];
    const retryAfterMs = oldest + windowMs - now;
    buckets.set(key, existing);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  const updated = [...existing, now];
  buckets.set(key, updated);
  return { allowed: true, remaining: limit - updated.length, retryAfterSeconds: 0 };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const LIMITS = {
  consultation: Number(process.env.AI_RATE_LIMIT_CONSULTATIONS ?? 15),
  tryOn: Number(process.env.AI_RATE_LIMIT_TRY_ONS ?? 30),
};

export function checkConsultationRateLimit(userId: number): RateLimitResult {
  return consumeRateLimit(`consultation:${userId}`, LIMITS.consultation || 15, DAY_MS);
}

export function checkTryOnRateLimit(userId: number): RateLimitResult {
  return consumeRateLimit(`try-on:${userId}`, LIMITS.tryOn || 30, DAY_MS);
}
