import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * The credit ledger (CreditLedgerEntry): one append-only row per change to a
 * spendable balance, written in the same transaction as the change itself.
 * UsageLog only ever recorded spending, so purchases, grants, refunds and
 * admin edits left no trace and no balance could be rebuilt or checked.
 *
 * Call recordLedger() right after the statement that moved the balance, with
 * the same db handle (pass the transaction client inside $transaction).
 */
type Db = Prisma.TransactionClient | typeof prisma;

export type LedgerType =
  | "OPENING_BALANCE"
  | "SIGNUP_GRANT"
  | "PURCHASE"
  | "REFERRAL_BONUS"
  | "ADMIN_ADJUSTMENT"
  | "SPEND"
  | "REFUND";

export interface LedgerEntry {
  userId: string;
  /** The team whose pooled wallet changed; null/omitted for the user's own balance. */
  teamId?: string | null;
  delta: number;
  type: LedgerType;
  operationId?: string | null;
  module?: string | null;
  provider?: string | null;
  model?: string | null;
  pricingVersion?: string | null;
  usageLogId?: string | null;
  paymentId?: string | null;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordLedger(db: Db, e: LedgerEntry): Promise<void> {
  if (!Number.isSafeInteger(e.delta) || e.delta === 0) return;
  const wallet = e.teamId
    ? await db.team.findUnique({ where: { id: e.teamId }, select: { credits: true } })
    : await db.user.findUnique({ where: { id: e.userId }, select: { credits: true } });
  await db.creditLedgerEntry.create({
    data: {
      userId: e.userId,
      teamId: e.teamId ?? null,
      delta: e.delta,
      balanceAfter: wallet?.credits ?? null,
      type: e.type,
      operationId: e.operationId ?? null,
      module: e.module ?? null,
      provider: e.provider ?? null,
      model: e.model ?? null,
      pricingVersion: e.pricingVersion ?? null,
      usageLogId: e.usageLogId ?? null,
      paymentId: e.paymentId ?? null,
      actorId: e.actorId ?? null,
      reason: e.reason ?? null,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
    },
  });
}

/** The team whose pooled wallet a user's DEFAULT-payer credits come from, or null for their own balance. */
export async function walletTeamId(db: Db, userId: string): Promise<string | null> {
  const membership = await db.teamMember.findUnique({ where: { userId }, select: { teamId: true } });
  return membership?.teamId ?? null;
}

export interface WalletDrift {
  userId: string | null;
  teamId: string | null;
  balance: number;
  ledger: number;
  drift: number;
  entries: number;
}

/**
 * Read-only check of every wallet against its ledger: the stored balance minus
 * the sum of its entries. Non-zero drift means a balance changed without a
 * ledger row (a write path not yet recorded) or a row without its change.
 * Wallets that have never had an entry are reported only when `includeEmpty`.
 */
export async function ledgerDrift(db: Db = prisma, opts: { includeEmpty?: boolean } = {}): Promise<WalletDrift[]> {
  const [users, teams, userSums, teamSums] = await Promise.all([
    db.user.findMany({ select: { id: true, credits: true } }),
    db.team.findMany({ select: { id: true, credits: true } }),
    db.creditLedgerEntry.groupBy({ by: ["userId"], where: { teamId: null }, _sum: { delta: true }, _count: { _all: true } }),
    db.creditLedgerEntry.groupBy({ by: ["teamId"], where: { teamId: { not: null } }, _sum: { delta: true }, _count: { _all: true } }),
  ]);
  const byUser = new Map(userSums.map((r) => [r.userId, r]));
  const byTeam = new Map(teamSums.map((r) => [r.teamId, r]));
  const out: WalletDrift[] = [];
  for (const u of users) {
    const r = byUser.get(u.id), ledger = r?._sum.delta ?? 0, entries = r?._count._all ?? 0;
    if (entries || opts.includeEmpty) out.push({ userId: u.id, teamId: null, balance: u.credits, ledger, drift: u.credits - ledger, entries });
  }
  for (const t of teams) {
    const r = byTeam.get(t.id), ledger = r?._sum.delta ?? 0, entries = r?._count._all ?? 0;
    if (entries || opts.includeEmpty) out.push({ userId: null, teamId: t.id, balance: t.credits, ledger, drift: t.credits - ledger, entries });
  }
  return out;
}
