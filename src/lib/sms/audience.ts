import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Who an admin SMS goes to. Picked users, typed numbers, or a segment of
 * customers who have a mobile number. Customers who opted out of marketing
 * (unsubscribed, or suppressed on any follow-up channel) are always left out of
 * segment and user sends, matching the phone export's rule.
 */
export const MAX_RECIPIENTS = 5000;

export type Audience =
  | { type: "users"; userIds: string[] }
  | { type: "phones"; phones: string[] }
  | { type: "segment"; segment: Segment };

export type Segment = {
  plans?: string[];
  /** "paid": at least one successful payment; "unpaid": none. */
  paid?: "paid" | "unpaid";
  /** Signed up within the last N days. */
  signedUpWithinDays?: number;
  languages?: string[];
  /** Only customers who gave marketing consent. */
  consentedOnly?: boolean;
};

/** Iranian mobile in the form the provider takes (09xxxxxxxxx), or null. */
export function normalizeMobile(raw: string): string | null {
  const d = raw.replace(/[\s-]/g, "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
  if (/^09\d{9}$/.test(d)) return d;
  if (/^\+989\d{9}$/.test(d)) return "0" + d.slice(3);
  if (/^989\d{9}$/.test(d)) return "0" + d.slice(2);
  if (/^9\d{9}$/.test(d)) return "0" + d;
  return null;
}

export function segmentWhere(s: Segment, now = new Date()): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [
    { role: "USER", isBlocked: false, phone: { not: null } },
    { OR: [{ growthProfile: null }, { growthProfile: { unsubscribedAt: null } }] },
    { followupSuppressions: { none: {} } },
  ];
  if (s.plans?.length) and.push({ plan: { in: s.plans } });
  if (s.paid === "paid") and.push({ payments: { some: { status: "SUCCESS" } } });
  if (s.paid === "unpaid") and.push({ payments: { none: { status: "SUCCESS" } } });
  if (s.signedUpWithinDays && s.signedUpWithinDays > 0) and.push({ createdAt: { gte: new Date(now.getTime() - s.signedUpWithinDays * 864e5) } });
  if (s.languages?.length) and.push({ language: { in: s.languages } });
  if (s.consentedOnly) and.push({ growthProfile: { marketingConsent: true } });
  return { AND: and };
}

/** Distinct valid numbers for the audience, capped at MAX_RECIPIENTS + 1 so callers can refuse oversized sends. */
export async function resolveAudience(a: Audience): Promise<{ mobiles: string[]; skipped: number }> {
  let raw: string[] = [];
  if (a.type === "phones") raw = a.phones;
  else {
    const where = a.type === "users"
      ? { AND: [{ id: { in: a.userIds.slice(0, MAX_RECIPIENTS + 1) } }, { phone: { not: null } }, { OR: [{ growthProfile: null }, { growthProfile: { unsubscribedAt: null } }] }, { followupSuppressions: { none: {} } }] }
      : segmentWhere(a.segment);
    const users = await prisma.user.findMany({ where, select: { phone: true }, take: MAX_RECIPIENTS + 1 });
    raw = users.map((u) => u.phone!);
    if (a.type === "users") return dedupe(raw, a.userIds.length);
  }
  return dedupe(raw, raw.length);
}

function dedupe(raw: string[], asked: number) {
  const mobiles = [...new Set(raw.map(normalizeMobile).filter((m): m is string => !!m))];
  return { mobiles, skipped: Math.max(0, asked - mobiles.length) };
}

/** 0912***4567: enough for an admin to check the list without exposing it. */
export const maskMobile = (m: string) => m.slice(0, 4) + "***" + m.slice(-4);
