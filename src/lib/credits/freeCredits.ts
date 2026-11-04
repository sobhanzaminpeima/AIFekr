import { prisma } from "@/lib/db/prisma";
import { recordLedger } from "./ledger";

/**
 * Free (promotional) credits for new accounts, owner configuration of
 * 2026-11-04: 100 at sign-up, a 50-credit activation bonus at the first
 * successful AI result, both expiring after 14 days, once per verified
 * account. Off until an admin turns it on in Admin → Settings (owner asked for
 * approval before production); while off, sign-up keeps its previous amounts.
 * SiteSetting `freeCreditsPolicy`.
 */
export type FreeCreditsPolicy = { enabled: boolean; signup: number; activationBonus: number; expiryDays: number };
export const FREE_CREDITS_DEFAULTS: FreeCreditsPolicy = { enabled: false, signup: 100, activationBonus: 50, expiryDays: 14 };
const KEY = "freeCreditsPolicy";

export async function freeCreditsPolicy(): Promise<FreeCreditsPolicy> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    const v = { ...FREE_CREDITS_DEFAULTS, ...(row ? JSON.parse(row.value) : {}) } as FreeCreditsPolicy;
    const n = (x: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
    return { enabled: v.enabled === true, signup: n(v.signup, 10000), activationBonus: n(v.activationBonus, 10000), expiryDays: Math.max(1, n(v.expiryDays, 365)) };
  } catch {
    return { ...FREE_CREDITS_DEFAULTS };
  }
}

export async function saveFreeCreditsPolicy(actorId: string, value: Partial<FreeCreditsPolicy>) {
  const next = { ...(await freeCreditsPolicy()), ...value };
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } }),
    prisma.auditLog.create({ data: { actorId, action: "free_credits.policy_updated", metadata: JSON.stringify(next) } }),
  ]);
  return freeCreditsPolicy();
}

/** Credits a new account starts with: the policy's when it is on, else the sign-up path's previous amount. */
export async function signupCredits(previous: number) {
  const p = await freeCreditsPolicy();
  return p.enabled ? p.signup : previous;
}

const expiryDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

/** Marks a new account's starting credits as promotional (they expire) when the policy is on. Called after the sign-up grant. */
export async function markSignupPromo(userId: string) {
  const p = await freeCreditsPolicy();
  if (!p.enabled) return;
  await prisma.creditLedgerEntry.updateMany({ where: { operationId: `signup:${userId}` }, data: { metadata: JSON.stringify({ promo: true, expiresAt: expiryDate(p.expiryDays) }) } });
}

/** The one-time activation bonus, at the account's first successful AI result (verified accounts only). */
export async function grantActivationBonus(userId: string) {
  const p = await freeCreditsPolicy();
  if (!p.enabled || !p.activationBonus) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleId: true, phone: true, createdAt: true } });
  // Only verified accounts (phone OTP or Google sign-in) created while the policy is on.
  if (!user || (!user.googleId && !user.phone)) return;
  const since = await prisma.siteSetting.findUnique({ where: { key: KEY }, select: { updatedAt: true } });
  if (since && user.createdAt < since.updatedAt) return;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { credits: { increment: p.activationBonus } } });
      await recordLedger(tx, { userId, delta: p.activationBonus, type: "PROMO_GRANT", operationId: `activation:${userId}`, module: "activation_bonus", metadata: { promo: true, expiresAt: expiryDate(p.expiryDays) } });
    });
  } catch { /* already granted (operationId is unique) */ }
}

/**
 * Removes what is left of expired promotional credits. Promotional credits are
 * treated as spent first: what expires is the promo amount minus everything the
 * account spent since it was granted, never more than the balance. Runs from
 * /api/cron/promo-credits.
 */
export async function expirePromoCredits(now = new Date()) {
  const grants = await prisma.creditLedgerEntry.findMany({ where: { teamId: null, metadata: { contains: '"promo":true' }, delta: { gt: 0 } }, orderBy: { createdAt: "asc" }, take: 2000 });
  const byUser = new Map<string, typeof grants>();
  for (const g of grants) byUser.set(g.userId, [...(byUser.get(g.userId) ?? []), g]);
  let expired = 0;
  for (const [userId, list] of byUser) {
    // Spending since the first grant is applied to the grants oldest first, once.
    const spent = await prisma.creditLedgerEntry.aggregate({ where: { userId, teamId: null, createdAt: { gte: list[0].createdAt }, type: { in: ["SPEND", "REFUND"] } }, _sum: { delta: true } });
    let pool = Math.max(0, -(spent._sum.delta ?? 0));
    for (const g of list) {
      const consumed = Math.min(g.delta, pool);
      pool -= consumed;
      let meta: { expiresAt?: string } = {};
      try { meta = JSON.parse(g.metadata || "{}"); } catch { continue; }
      if (!meta.expiresAt || new Date(meta.expiresAt) > now) continue;
      const op = `promo-expire:${g.id}`;
      if (await prisma.creditLedgerEntry.findUnique({ where: { operationId: op }, select: { id: true } })) continue;
      const left = g.delta - consumed;
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
          const amount = Math.min(left, user?.credits ?? 0);
          if (amount > 0) await tx.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } });
          // Always written (even 0) so the grant is settled once.
          await tx.creditLedgerEntry.create({ data: { userId, delta: -amount, balanceAfter: (user?.credits ?? 0) - amount, type: "PROMO_EXPIRED", operationId: op, module: g.module, metadata: JSON.stringify({ grantId: g.id }) } });
        });
        expired++;
      } catch { /* settled by a concurrent run */ }
    }
  }
  return { checked: grants.length, expired };
}
