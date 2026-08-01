interface Bucket {
  count: number;
  resetAt: number;
}

// Module-level Map — persists across requests only because this app runs as a single
// long-lived PM2 process (`next start`, fork mode, no cluster/serverless). Sweeping
// happens lazily (every call has a small chance to run it) since edge runtime doesn't
// reliably support setInterval for background cleanup.
const store = new Map<string, Bucket>();
let callsSinceSweep = 0;

function sweepExpired(now: number) {
  store.forEach((bucket, key) => {
    if (bucket.resetAt < now) store.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= 500) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
