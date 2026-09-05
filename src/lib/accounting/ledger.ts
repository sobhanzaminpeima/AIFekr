import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/**
 * The accounting module's ledger core (Phase A). This file is the ONLY
 * allowed write path to AccountingJournalEntryLine — every financial event
 * (invoice issued, payment received, manual entry, etc.) must go through
 * postJournalEntry(). No other code may call
 * prisma.accountingJournalEntryLine.create/createMany directly; that's what
 * makes the double-entry balance guarantee actually hold across the whole
 * app, not just in the one function that happens to be careful about it.
 *
 * Tenant isolation is application-level (workspaceUserId), matching
 * resolveCrmWorkspace()'s pattern used everywhere else in this codebase —
 * this app runs on SQLite, which has no RLS. See the schema.prisma comment
 * above AccountingAccount for the full rationale (confirmed with the user
 * rather than assumed).
 */

const BALANCE_EPSILON = 0.005; // half a cent — guards against float rounding, not real imbalance

export interface PostJournalLineInput {
  /** AccountingAccount.code within this workspace, e.g. "1000", "4000". */
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostJournalEntryInput {
  workspaceUserId: string;
  /** User.id who posted this, or "system" for auto-posted entries. */
  postedBy: string;
  memo?: string;
  entryDate?: Date;
  /**
   * Idempotency key for auto-posted entries (e.g. "invoice:paid:<id>"). If an
   * entry with this sourceRef already exists, postJournalEntry() returns it
   * unchanged instead of posting a duplicate — safe against webhook retries
   * or a route being called twice for the same event.
   */
  sourceRef?: string;
  lines: PostJournalLineInput[];
}

export class UnbalancedEntryError extends Error {
  constructor(debitTotal: number, creditTotal: number) {
    super(`Journal entry is not balanced: debit ${debitTotal} != credit ${creditTotal}`);
    this.name = "UnbalancedEntryError";
  }
}

export class PeriodLockedError extends Error {
  constructor(entryDate: Date) {
    super(`Cannot post to ${entryDate.toISOString().slice(0, 10)} — its fiscal period is locked`);
    this.name = "PeriodLockedError";
  }
}

export class UnknownAccountError extends Error {
  constructor(code: string) {
    super(`No account with code "${code}" in this workspace`);
    this.name = "UnknownAccountError";
  }
}

/**
 * The sole write path to the ledger. Validates balance (debit total ==
 * credit total), resolves account codes to ids within the caller's
 * workspace (never cross-tenant), rejects postings into a locked fiscal
 * period, and is idempotent via sourceRef. Throws one of the typed errors
 * above on any invariant violation — callers should not catch these to
 * "fix" the data, only to surface the error.
 */
export async function postJournalEntry(input: PostJournalEntryInput): Promise<Prisma.AccountingJournalEntryGetPayload<{ include: { lines: true } }>> {
  const { workspaceUserId, postedBy, memo, sourceRef } = input;
  const entryDate = input.entryDate || new Date();

  if (input.lines.length < 2) {
    throw new Error("A journal entry needs at least two lines");
  }

  // Idempotency: a prior post with this sourceRef wins — return it as-is.
  if (sourceRef) {
    const existing = await prisma.accountingJournalEntry.findUnique({
      where: { sourceRef },
      include: { lines: true },
    });
    if (existing) return existing;
  }

  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of input.lines) {
    const debit = line.debit || 0;
    const credit = line.credit || 0;
    if (debit < 0 || credit < 0) throw new Error("Debit/credit amounts cannot be negative");
    if (debit > 0 && credit > 0) throw new Error("A single line cannot be both debit and credit");
    if (debit === 0 && credit === 0) throw new Error("A line must have a non-zero debit or credit");
    debitTotal += debit;
    creditTotal += credit;
  }
  if (Math.abs(debitTotal - creditTotal) > BALANCE_EPSILON) {
    throw new UnbalancedEntryError(debitTotal, creditTotal);
  }

  const lockedPeriod = await prisma.accountingFiscalPeriod.findFirst({
    where: { workspaceUserId, isLocked: true, startDate: { lte: entryDate }, endDate: { gte: entryDate } },
  });
  if (lockedPeriod) throw new PeriodLockedError(entryDate);

  const codes = Array.from(new Set(input.lines.map((l) => l.accountCode)));
  const accounts = await prisma.accountingAccount.findMany({
    where: { workspaceUserId, code: { in: codes } },
    select: { id: true, code: true },
  });
  const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) {
    if (!accountIdByCode.has(code)) throw new UnknownAccountError(code);
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.accountingJournalEntry.create({
        data: {
          workspaceUserId,
          postedBy,
          memo,
          entryDate,
          sourceRef,
          lines: {
            create: input.lines.map((l) => ({
              accountId: accountIdByCode.get(l.accountCode)!,
              debit: l.debit || 0,
              credit: l.credit || 0,
              memo: l.memo,
            })),
          },
        },
        include: { lines: true },
      });
      return created;
    });

    await prisma.auditLog.create({
      data: {
        actorId: postedBy,
        action: "journal_entry_posted",
        targetId: entry.id,
        metadata: JSON.stringify({ workspaceUserId, sourceRef: sourceRef || null, debitTotal, creditTotal }),
      },
    }).catch(() => {});

    return entry;
  } catch (err) {
    // A concurrent request that raced us to the same sourceRef — re-fetch
    // and return the winner's entry instead of surfacing a spurious error.
    if (sourceRef && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.accountingJournalEntry.findUnique({ where: { sourceRef }, include: { lines: true } });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Reverses a posted entry: creates a new entry with every line's debit/credit
 * swapped (net effect zero), links it back via reversesEntryId, and flips
 * isReversed on the original. Never mutates or deletes the original —
 * corrections are always reversal + new entry, per the spec's immutability
 * requirement.
 */
export async function reverseJournalEntry(entryId: string, postedBy: string, memo?: string) {
  const original = await prisma.accountingJournalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: { include: { account: true } } },
  });
  if (original.isReversed) throw new Error("This entry has already been reversed");

  const reversal = await postJournalEntry({
    workspaceUserId: original.workspaceUserId,
    postedBy,
    memo: memo || `Reversal of entry ${original.id}`,
    entryDate: new Date(),
    lines: original.lines.map((l) => ({
      accountCode: l.account.code,
      debit: l.credit,
      credit: l.debit,
      memo: l.memo || undefined,
    })),
  });

  await prisma.$transaction([
    // sourceRef is cleared here so a later corrected re-post can reclaim the
    // same idempotency key — postJournalEntry()'s sourceRef lookup would
    // otherwise keep finding this reversed, dead entry and silently skip
    // posting the correction (the bug this fixes: a reopened owner statement
    // that gets regenerated and re-approved must actually post a new entry).
    prisma.accountingJournalEntry.update({ where: { id: original.id }, data: { isReversed: true, sourceRef: null } }),
    prisma.accountingJournalEntry.update({ where: { id: reversal.id }, data: { reversesEntryId: original.id } }),
  ]);

  return reversal;
}
