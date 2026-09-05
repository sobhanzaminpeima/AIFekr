import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { postJournalEntry, reverseJournalEntry, UnbalancedEntryError, PeriodLockedError, UnknownAccountError } from "./ledger";
import { getTrialBalance } from "./reports";

// Integration tests against the real (dev) SQLite database — AccountingAccount
// has no FK to User, so a fake workspaceUserId needs no real user row. Every
// row created here is scoped to workspace ids unique to this test file and
// deleted in afterAll, so this never touches real data.
const WS_A = `test-ledger-a-${Date.now()}`;
const WS_B = `test-ledger-b-${Date.now()}`;

async function seedAccounts(workspaceUserId: string) {
  await prisma.accountingAccount.createMany({
    data: [
      { workspaceUserId, code: "1000", name: "Cash", type: "asset" },
      { workspaceUserId, code: "4000", name: "Revenue", type: "revenue" },
    ],
  });
}

async function cleanupWorkspace(workspaceUserId: string) {
  const accounts = await prisma.accountingAccount.findMany({ where: { workspaceUserId }, select: { id: true } });
  const accountIds = accounts.map((a) => a.id);
  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  if (entryIds.length) await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entryIds } } });
  if (entryIds.length) await prisma.accountingJournalEntry.deleteMany({ where: { id: { in: entryIds } } });
  if (accountIds.length) await prisma.accountingAccount.deleteMany({ where: { id: { in: accountIds } } });
}

beforeAll(async () => {
  await seedAccounts(WS_A);
  await seedAccounts(WS_B);
});

afterAll(async () => {
  await cleanupWorkspace(WS_A);
  await cleanupWorkspace(WS_B);
});

describe("postJournalEntry — balance invariant", () => {
  it("posts a balanced entry successfully", async () => {
    const entry = await postJournalEntry({
      workspaceUserId: WS_A,
      postedBy: "system",
      lines: [
        { accountCode: "1000", debit: 100 },
        { accountCode: "4000", credit: 100 },
      ],
    });
    expect(entry.lines).toHaveLength(2);
  });

  it("rejects an unbalanced entry (debit != credit)", async () => {
    await expect(
      postJournalEntry({
        workspaceUserId: WS_A,
        postedBy: "system",
        lines: [
          { accountCode: "1000", debit: 100 },
          { accountCode: "4000", credit: 50 },
        ],
      })
    ).rejects.toThrow(UnbalancedEntryError);
  });

  it("rejects a line that is both debit and credit", async () => {
    await expect(
      postJournalEntry({
        workspaceUserId: WS_A,
        postedBy: "system",
        lines: [
          { accountCode: "1000", debit: 100, credit: 100 },
          { accountCode: "4000", credit: 100 },
        ],
      })
    ).rejects.toThrow();
  });

  it("rejects fewer than two lines", async () => {
    await expect(
      postJournalEntry({ workspaceUserId: WS_A, postedBy: "system", lines: [{ accountCode: "1000", debit: 100 }] })
    ).rejects.toThrow();
  });

  it("rejects an unknown account code", async () => {
    await expect(
      postJournalEntry({
        workspaceUserId: WS_A,
        postedBy: "system",
        lines: [
          { accountCode: "9999", debit: 100 },
          { accountCode: "4000", credit: 100 },
        ],
      })
    ).rejects.toThrow(UnknownAccountError);
  });
});

describe("postJournalEntry — idempotency", () => {
  it("posting the same sourceRef twice does not create a duplicate entry", async () => {
    const sourceRef = `test:idempotent:${Date.now()}`;
    const first = await postJournalEntry({
      workspaceUserId: WS_A,
      postedBy: "system",
      sourceRef,
      lines: [
        { accountCode: "1000", debit: 50 },
        { accountCode: "4000", credit: 50 },
      ],
    });
    const second = await postJournalEntry({
      workspaceUserId: WS_A,
      postedBy: "system",
      sourceRef,
      lines: [
        { accountCode: "1000", debit: 50 },
        { accountCode: "4000", credit: 50 },
      ],
    });
    expect(second.id).toBe(first.id);

    const count = await prisma.accountingJournalEntry.count({ where: { sourceRef } });
    expect(count).toBe(1);
  });
});

describe("postJournalEntry — fiscal period locking", () => {
  it("rejects a posting dated inside a locked period", async () => {
    const start = new Date("2020-01-01");
    const end = new Date("2020-01-31");
    const period = await prisma.accountingFiscalPeriod.create({
      data: { workspaceUserId: WS_A, startDate: start, endDate: end, isLocked: true },
    });
    try {
      await expect(
        postJournalEntry({
          workspaceUserId: WS_A,
          postedBy: "system",
          entryDate: new Date("2020-01-15"),
          lines: [
            { accountCode: "1000", debit: 10 },
            { accountCode: "4000", credit: 10 },
          ],
        })
      ).rejects.toThrow(PeriodLockedError);
    } finally {
      await prisma.accountingFiscalPeriod.delete({ where: { id: period.id } });
    }
  });
});

describe("reverseJournalEntry — sourceRef reuse after reversal", () => {
  it("frees the sourceRef so a corrected re-post actually posts a new entry (not the stale reversed one)", async () => {
    const sourceRef = `test:reversible:${Date.now()}`;
    const original = await postJournalEntry({
      workspaceUserId: WS_A,
      postedBy: "system",
      sourceRef,
      lines: [
        { accountCode: "1000", debit: 200 },
        { accountCode: "4000", credit: 200 },
      ],
    });

    await reverseJournalEntry(original.id, "system", "correction");

    const reversedOriginal = await prisma.accountingJournalEntry.findUniqueOrThrow({ where: { id: original.id } });
    expect(reversedOriginal.isReversed).toBe(true);
    expect(reversedOriginal.sourceRef).toBeNull();

    // Re-post the corrected amount under the SAME sourceRef the original used.
    const corrected = await postJournalEntry({
      workspaceUserId: WS_A,
      postedBy: "system",
      sourceRef,
      lines: [
        { accountCode: "1000", debit: 150 },
        { accountCode: "4000", credit: 150 },
      ],
    });

    expect(corrected.id).not.toBe(original.id);

    const trialBalance = await getTrialBalance(WS_A);
    const cash = trialBalance.find((r) => r.code === "1000");
    // Net effect on this account from this sequence: +200 (original) -200 (reversal) +150 (corrected) = +150.
    expect(cash!.debitTotal - cash!.creditTotal).toBeGreaterThanOrEqual(150);
  });
});

describe("tenant isolation", () => {
  it("workspace A's trial balance never includes workspace B's postings", async () => {
    await postJournalEntry({
      workspaceUserId: WS_B,
      postedBy: "system",
      lines: [
        { accountCode: "1000", debit: 9999 },
        { accountCode: "4000", credit: 9999 },
      ],
    });

    const trialBalanceA = await getTrialBalance(WS_A);
    const leaked = trialBalanceA.some((row) => row.debitTotal === 9999 || row.creditTotal === 9999);
    expect(leaked).toBe(false);

    const trialBalanceB = await getTrialBalance(WS_B);
    const cashRowB = trialBalanceB.find((row) => row.code === "1000");
    expect(cashRowB?.debitTotal).toBe(9999);
  });
});
