/**
 * One charge per paid request. A client sends an `Idempotency-Key` header with
 * each paid submission and repeats the same key on a retry; a second request
 * with a key still in use is refused before anything is charged. A key whose
 * work failed (and was refunded) is released, so the same retry may run again.
 *
 * The site runs as one Node process, so an in-memory claim covers concurrent
 * double-submits. Claims expire after `TTL_MS`.
 */
const TTL_MS = 10 * 60 * 1000;
const claims = new Map<string, number>();

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/** The request's idempotency key, or null when absent or malformed (malformed keys are ignored, never trusted). */
export function idempotencyKeyOf(headers: Headers): string | null {
  const key = headers.get("idempotency-key")?.trim() ?? "";
  return KEY_PATTERN.test(key) ? key : null;
}

const slot = (userId: string, feature: string, key: string) => `${userId}|${feature}|${key}`;

/** True when this request may proceed; false when the same key is already being or has been charged. */
export function claimIdempotencyKey(userId: string, feature: string, key: string, now = Date.now()): boolean {
  for (const [k, at] of claims) if (now - at > TTL_MS) claims.delete(k);
  const s = slot(userId, feature, key);
  if (claims.has(s)) return false;
  claims.set(s, now);
  return true;
}

/** Frees a key after its work failed and was refunded, so a retry with it can run. */
export function releaseIdempotencyKey(userId: string, feature: string, key: string) {
  claims.delete(slot(userId, feature, key));
}

/** For the charge record: ties the usage row to the client's key. */
export const idempotencyRequestId = (feature: string, key: string) => `idem:${feature}:${key}`.slice(0, 190);
