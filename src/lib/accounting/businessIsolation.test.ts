import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultChartOfAccounts } from "./chartOfAccounts";
import { postJournalEntry } from "./ledger";
import { createFiscalPeriod, listFiscalPeriods, closeFiscalPeriod } from "./fiscalPeriod";
import { setBudget, getBudgetVsActual } from "./budget";

/**
 * Multi-business accounting isolation. One workspace owner can run several
 * businesses (an Organization such as a holding group), and every business
 * must keep its OWN ledger, chart of accounts, fiscal periods and budgets --
 * never merged, never readable from the other. These run against the real dev
 * database, with ids namespaced so a failed run leaves nothing behind.
 */
const P = `acctiso${Date.now().toString(36)}`;
const wsUserId = `${P}ws`;
const bizA = `${P}bizA`;
const bizB = `${P}bizB`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: wsUserId, name: "Workspace owner" } });
  await ensureDefaultChartOfAccounts(wsUserId, bizA);
  await ensureDefaultChartOfAccounts(wsUserId, bizB);
}, 60_000);

afterAll(async () => {
  await prisma.accountingBudget.deleteMany({ where: { workspaceUserId: wsUserId } });
  await prisma.accountingFiscalPeriod.deleteMany({ where: { workspaceUserId: wsUserId } });
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entry: { workspaceUserId: wsUserId } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { workspaceUserId: wsUserId } });
  await prisma.accountingAccount.deleteMany({ where: { workspaceUserId: wsUserId } });
  await prisma.auditLog.deleteMany({ where: { actorId: `${P}mgr` } });
  await prisma.user.deleteMany({ where: { id: wsUserId } });
});

describe("chart of accounts", () => {
  it("gives every business its own full set of accounts under one workspace owner", async () => {
    const a = await prisma.accountingAccount.count({ where: { workspaceUserId: wsUserId, businessId: bizA } });
    const b = await prisma.accountingAccount.count({ where: { workspaceUserId: wsUserId, businessId: bizB } });
    expect(a).toBeGreaterThan(5);
    expect(b).toBe(a);
  });

  it("is idempotent per business (re-running does not duplicate)", async () => {
    const before = await prisma.accountingAccount.count({ where: { workspaceUserId: wsUserId, businessId: bizA } });
    await ensureDefaultChartOfAccounts(wsUserId, bizA);
    expect(await prisma.accountingAccount.count({ where: { workspaceUserId: wsUserId, businessId: bizA } })).toBe(before);
  });
});

describe("ledger", () => {
  it("posts into one business's books without touching the other's", async () => {
    await postJournalEntry({
      workspaceUserId: wsUserId, businessId: bizA, postedBy: `${P}mgr`, memo: "A only",
      sourceRef: `${P}:a1`, lines: [{ accountCode: "1000", debit: 500 }, { accountCode: "4000", credit: 500 }],
    });

    const linesA = await prisma.accountingJournalEntryLine.count({ where: { entry: { workspaceUserId: wsUserId, businessId: bizA } } });
    const linesB = await prisma.accountingJournalEntryLine.count({ where: { entry: { workspaceUserId: wsUserId, businessId: bizB } } });
    expect(linesA).toBe(2);
    expect(linesB).toBe(0);
  });
});

describe("fiscal periods", () => {
  it("lists and closes only the caller's business's periods", async () => {
    const pa = await createFiscalPeriod(wsUserId, new Date(2031, 0, 1), new Date(2031, 0, 31), bizA);
    await createFiscalPeriod(wsUserId, new Date(2031, 0, 1), new Date(2031, 0, 31), bizB);

    expect((await listFiscalPeriods(wsUserId, bizA)).map((p) => p.id)).toEqual([pa.id]);
    expect(await listFiscalPeriods(wsUserId, bizB)).toHaveLength(1);
  });

  it("refuses to close another business's period even with a valid period id (IDOR)", async () => {
    const pa = (await listFiscalPeriods(wsUserId, bizA))[0];
    await expect(closeFiscalPeriod(pa.id, wsUserId, `${P}mgr`, bizB)).rejects.toThrow(/not found/i);
    // ...and the owner business can.
    await expect(closeFiscalPeriod(pa.id, wsUserId, `${P}mgr`, bizA)).resolves.toBeTruthy();
  });
});

describe("budgets", () => {
  it("keeps the same account+month budget separate per business", async () => {
    const month = new Date(2031, 2, 15);
    await setBudget(wsUserId, "5100", month, 1000, bizA);
    await setBudget(wsUserId, "5100", month, 9000, bizB);

    const a = await prisma.accountingBudget.findFirst({ where: { workspaceUserId: wsUserId, businessId: bizA, accountCode: "5100" } });
    const b = await prisma.accountingBudget.findFirst({ where: { workspaceUserId: wsUserId, businessId: bizB, accountCode: "5100" } });
    expect(a?.amount).toBe(1000);
    expect(b?.amount).toBe(9000);
  });

  it("updates in place instead of duplicating when set twice for one business", async () => {
    const month = new Date(2031, 2, 15);
    await setBudget(wsUserId, "5100", month, 1234, bizA);
    expect(await prisma.accountingBudget.count({ where: { workspaceUserId: wsUserId, businessId: bizA, accountCode: "5100" } })).toBe(1);
    expect((await prisma.accountingBudget.findFirst({ where: { workspaceUserId: wsUserId, businessId: bizA, accountCode: "5100" } }))?.amount).toBe(1234);
  });

  it("budget-vs-actual only reads the caller's business ledger", async () => {
    const rows = await getBudgetVsActual(wsUserId, new Date(2031, 2, 1), bizB);
    expect(rows.map((r) => r.budgeted)).toEqual([9000]);
  });
});
