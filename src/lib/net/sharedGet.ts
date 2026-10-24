/**
 * De-duplicates identical background GETs from components that are mounted
 * more than once. The dashboard renders the sidebar twice (desktop rail and
 * mobile drawer) plus a header bell, so notifications, organizations,
 * projects and module status were each fetched 3-4x per page -- enough for a
 * user clicking through pages to hit the /api rate limit and see 429s.
 * Calls for the same URL within `maxAgeMs` share one request and its parsed
 * JSON. Only for read-only data; pass `fresh` after a mutation.
 */
const recent = new Map<string, { at: number; result: Promise<unknown> }>();

export function sharedGetJson<T>(url: string, { maxAgeMs = 5000, fresh = false }: { maxAgeMs?: number; fresh?: boolean } = {}): Promise<T | null> {
  const hit = recent.get(url);
  if (!fresh && hit && Date.now() - hit.at < maxAgeMs) return hit.result as Promise<T | null>;
  const result = fetch(url, { credentials: "include" })
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null);
  recent.set(url, { at: Date.now(), result });
  return result;
}
