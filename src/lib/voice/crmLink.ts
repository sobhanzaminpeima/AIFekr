import { prisma } from "@/lib/db/prisma";

/**
 * Loosely normalizes a phone number for best-effort matching between Vapi's
 * `callerPhone` (usually E.164, e.g. "+989121234567") and however a CRM
 * contact's phone happens to be stored (e.g. "09121234567", "0912 123 4567").
 * Strips everything but digits, then drops a leading Iranian country code
 * (98) or trunk prefix (0) so "+989121234567", "00989121234567",
 * "09121234567" and "9121234567" all collapse to the same "9121234567" key.
 * Best-effort only — never throws, never used for anything beyond matching.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits || null;
}

/**
 * Best-effort match of a call's caller phone to an existing CrmContact owned
 * by the same user. Never creates a new contact — a false-positive link is
 * far worse than leaving contactId null, so this only returns a match when
 * the normalized digits line up exactly. Returns null on no match.
 */
export async function matchCrmContactByPhone(userId: string, callerPhone: string | null | undefined): Promise<string | null> {
  const normalized = normalizePhone(callerPhone);
  if (!normalized) return null;

  // SQLite has no phone-normalizing index to query against, so pull the
  // user's contacts with a phone set and compare in memory — CRM contact
  // counts are small enough (hundreds, not millions) for this to be cheap.
  // orderBy makes the pick deterministic when two contacts share a phone
  // number (duplicate contacts) — most-recently-updated wins, rather than
  // whatever order SQLite happens to return rows in.
  const candidates = await prisma.crmContact.findMany({
    where: { userId, phone: { not: null } },
    select: { id: true, phone: true },
    orderBy: { updatedAt: "desc" },
  });
  const hit = candidates.find((c) => normalizePhone(c.phone) === normalized);
  return hit?.id || null;
}
