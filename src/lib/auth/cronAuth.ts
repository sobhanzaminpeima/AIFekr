import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Shared-secret check for /api/cron/* routes.
 *
 * The secret used to travel only in the query string (`?secret=...`), which web
 * servers, proxies and browsers all log -- so the cron secret sat in plaintext
 * in access logs. It is now accepted in the `x-cron-secret` header or as
 * `Authorization: Bearer <secret>` (neither is logged by default). The query
 * parameter is still accepted so existing crontab entries keep working until
 * they are switched over; new entries should use the header.
 *
 * Compared in constant time, and refused outright when CRON_SECRET is unset.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const provided = req.headers.get("x-cron-secret") || bearer || req.nextUrl.searchParams.get("secret");
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
