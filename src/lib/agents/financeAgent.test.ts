import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { proposeJournalEntry, approveProposal, rejectProposal, proposeExpenseCategorization, detectAnomalies, suggestOwnerStatementLines, runAuditCopilot } from "./financeAgent";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { createExpense, approveExpense } from "@/lib/accounting/expenses";
import { createFiscalPeriod, closeFiscalPeriod, reopenFiscalPeriod } from "@/lib/accounting/fiscalPeriod";

/**
 * These tests exercise the Draft-and-Approve boundary directly — never call
 * routedStreamChat (no real model call in the test suite); the categorization
 * test is built to hit the deterministic heuristic path (>=3 prior matches),
 * not the AI fallback, same as how the rest of this module avoids network
 * calls in its test suite.
 */

const WS = `test-phasee-${Date.now()}`;
let wsUser: { id: string };

beforeAll(async () => {
  wsUser = await prisma.user.create({ data: { name: "PhaseE Workspace", email: `phasee-ws-${Date.now()}@test.local`, passwordHash: "x" } });
  await prisma.accountingAccount.createMany({
    data: [
      { workspaceUserId: wsUser.id, code: "1000", name: "Cash", type: "asset" },
      { workspaceUserId: wsUser.id, code: "4000", name: "Revenue", type: "revenue" },
      { workspaceUserId: wsUser.id, code: "5200", name: "Advertising", type: "expense" },
      { workspaceUserId: wsUser.id, code: "5900", name: "Other", type: "expense" },
    ],
  });
});

afterAll(async () => {
  const proposals = await prisma.accountingAiProposal.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  await prisma.accountingAiProposal.deleteMany({ where: { id: { in: proposals.map((p) => p.id) } } });

  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId: wsUser.id }, select: { id: true } });
  const entryIds = entries.map((e) => e.id);
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entryIds } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { id: { in: entryIds } } });

  await prisma.accountingExpense.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.accountingAccount.deleteMany({ where: { workspaceUserId: wsUser.id } });
  await prisma.auditLog.deleteMany({ where: { actorId: wsUser.id } });
  await prisma.user.delete({ where: { id: wsUser.id } });
});

describe("proposeJournalEntry / approveProposal / rejectProposal", () => {
  it("refuses to create a proposal for an unbalanced entry", async () => {
    await expect(
      proposeJournalEntry({ workspaceUserId: wsUser.id, requestedBy: "system", memo: "bad", lines: [{ accountCode: "1000", debit: 100 }, { accountCode: "4000", credit: 90 }] })
    ).rejects.toThrow();
  });

  it("a pending proposal never touches the ledger until approved", async () => {
    const proposal = await proposeJournalEntry({
      workspaceUserId: wsUser.id,
      requestedBy: "system",
      memo: "AI-suggested correction",
      lines: [{ accountCode: "1000", debit: 50000 }, { accountCode: "4000", credit: 50000 }],
    });
    expect(proposal.status).toBe("pending");

    const entriesBefore = await prisma.accountingJournalEntry.count({ where: { workspaceUserId: wsUser.id } });
    expect(entriesBefore).toBe(0);

    const approved = await approveProposal(proposal.id, wsUser.id, "manager-1");
    expect(approved.status).toBe("approved");

    const entry = await prisma.accountingJournalEntry.findUnique({ where: { sourceRef: `ai_proposal:${proposal.id}` }, include: { lines: true } });
    expect(entry).not.toBeNull();
    const debitTotal = entry!.lines.reduce((s, l) => s + l.debit, 0);
    const creditTotal = entry!.lines.reduce((s, l) => s + l.credit, 0);
    expect(debitTotal).toBe(creditTotal);
    expect(debitTotal).toBe(50000);

    await expect(approveProposal(proposal.id, wsUser.id, "manager-1")).rejects.toThrow(); // already approved
  });

  it("rejecting a proposal marks it rejected and posts nothing", async () => {
    const proposal = await proposeJournalEntry({
      workspaceUserId: wsUser.id,
      requestedBy: "system",
      memo: "should never post",
      lines: [{ accountCode: "1000", debit: 1000 }, { accountCode: "4000", credit: 1000 }],
    });
    const rejected = await rejectProposal(proposal.id, wsUser.id, "manager-1");
    expect(rejected.status).toBe("rejected");
    const entry = await prisma.accountingJournalEntry.findUnique({ where: { sourceRef: `ai_proposal:${proposal.id}` } });
    expect(entry).toBeNull();
  });

  it("cannot be scoped to another workspace's proposal", async () => {
    const otherWs = await prisma.user.create({ data: { name: "Other WS", email: `other-ws-${Date.now()}@test.local`, passwordHash: "x" } });
    const proposal = await proposeJournalEntry({
      workspaceUserId: wsUser.id,
      requestedBy: "system",
      memo: "isolation check",
      lines: [{ accountCode: "1000", debit: 10 }, { accountCode: "4000", credit: 10 }],
    });
    await expect(approveProposal(proposal.id, otherWs.id, "intruder")).rejects.toThrow();
    await prisma.accountingAiProposal.delete({ where: { id: proposal.id } });
    await prisma.user.delete({ where: { id: otherWs.id } });
  });
});

describe("proposeExpenseCategorization — deterministic heuristic path", () => {
  it("proposes the majority-voted account code from prior similar expenses, without a model call", async () => {
    for (let i = 0; i < 3; i++) {
      // Under the approval threshold — createExpense() already marks these "approved".
      await createExpense({ workspaceUserId: wsUser.id, accountCode: "5200", amount: 10000, description: "Google Ads campaign boost" });
    }
    const target = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5900", amount: 15000, description: "Google Ads campaign renewal" });

    const proposal = await proposeExpenseCategorization(wsUser.id, target.id, "manager-1");
    expect(proposal.status).toBe("pending");
    expect(proposal.modelUsed).toBe("heuristic");
    const payload = JSON.parse(proposal.payload);
    expect(payload.suggestedAccountCode).toBe("5200");

    const approved = await approveProposal(proposal.id, wsUser.id, "manager-1");
    expect(approved.status).toBe("approved");
    const updated = await prisma.accountingExpense.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.accountCode).toBe("5200");
  });
});

describe("detectAnomalies", () => {
  it("flags a month whose expense on an account deviates sharply from the trailing average", async () => {
    const now = new Date();
    // Three normal-sized prior months on account 5900.
    for (let i = 1; i <= 3; i++) {
      const entryDate = new Date(now.getFullYear(), now.getMonth() - i, 10);
      await postJournalEntry({
        workspaceUserId: wsUser.id,
        postedBy: "system",
        entryDate,
        lines: [{ accountCode: "5900", debit: 100000 }, { accountCode: "1000", credit: 100000 }],
      });
    }
    // A current-month spike.
    await postJournalEntry({
      workspaceUserId: wsUser.id,
      postedBy: "system",
      lines: [{ accountCode: "5900", debit: 500000 }, { accountCode: "1000", credit: 500000 }],
    });

    const alerts = await detectAnomalies(wsUser.id, 50);
    const alert = alerts.find((a) => a.accountCode === "5900");
    expect(alert).toBeDefined();
    expect(alert!.deviationPercent).toBeGreaterThan(50);
  });
});

describe("suggestOwnerStatementLines — deterministic booking-derived income, no model call", () => {
  it("computes exact income from nights-in-month × nightlyPrice, clipped to the month", async () => {
    const property = await prisma.property.create({
      data: { userId: wsUser.id, title: "Test Unit", listingType: "short_term_rent", propertyType: "apartment", price: 0, nightlyPrice: 1000000, address: "Test address" },
    });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // A 5-night stay fully inside the month.
    await prisma.propertyBooking.create({
      data: { userId: wsUser.id, propertyId: property.id, guestName: "Ali", checkIn: new Date(monthStart.getTime() + 2 * 86400000), checkOut: new Date(monthStart.getTime() + 7 * 86400000), status: "confirmed" },
    });
    // A cancelled booking must be ignored entirely.
    await prisma.propertyBooking.create({
      data: { userId: wsUser.id, propertyId: property.id, guestName: "Cancelled Guest", checkIn: new Date(monthStart.getTime() + 10 * 86400000), checkOut: new Date(monthStart.getTime() + 12 * 86400000), status: "cancelled" },
    });

    const lines = await suggestOwnerStatementLines(wsUser.id, property.id, monthStart);
    expect(lines).toHaveLength(1);
    expect(lines[0].source).toBe("booking");
    expect(lines[0].category).toBe("guest_stay");
    expect(lines[0].income).toBe(5 * 1000000);

    await prisma.propertyBooking.deleteMany({ where: { propertyId: property.id } });
    await prisma.property.delete({ where: { id: property.id } });
  });

  it("rejects a property outside this workspace", async () => {
    const otherWs = await prisma.user.create({ data: { name: "Other WS 2", email: `other-ws2-${Date.now()}@test.local`, passwordHash: "x" } });
    const property = await prisma.property.create({
      data: { userId: otherWs.id, title: "Foreign Unit", listingType: "short_term_rent", propertyType: "apartment", price: 0, address: "Test address" },
    });
    await expect(suggestOwnerStatementLines(wsUser.id, property.id, new Date())).rejects.toThrow();
    await prisma.property.delete({ where: { id: property.id } });
    await prisma.user.delete({ where: { id: otherWs.id } });
  });
});

describe("runAuditCopilot — deterministic pre-close review, no model call", () => {
  it("reports ready-to-close on a clean period with no open items", async () => {
    const from = new Date(2020, 0, 1);
    const to = new Date(2020, 0, 31, 23, 59, 59);
    const report = await runAuditCopilot(wsUser.id, from, to);
    expect(report.ledgerBalanced).toBe(true);
    expect(report.findings).toHaveLength(0);
    expect(report.readyToClose).toBe(true);
  });

  it("flags a pending (unapproved) expense in the period", async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 1000);
    // Above the default approval threshold -> stays "pending_approval".
    const expense = await createExpense({ workspaceUserId: wsUser.id, accountCode: "5900", amount: 10_000_000, description: "Big unapproved expense" });
    expect(expense.status).toBe("pending_approval");

    const report = await runAuditCopilot(wsUser.id, from, to);
    const finding = report.findings.find((f) => f.category === "pending_expense");
    expect(finding).toBeDefined();
    expect(finding!.count).toBeGreaterThanOrEqual(1);
    expect(report.readyToClose).toBe(false);

    await approveExpense(expense.id, "manager-1"); // clean up so later tests aren't polluted
    await prisma.accountingExpense.delete({ where: { id: expense.id } });
  });
});

describe("fiscal period lifecycle", () => {
  it("close is human-triggered and audit-logged; reopen requires it be closed first", async () => {
    const period = await createFiscalPeriod(wsUser.id, new Date(2019, 0, 1), new Date(2019, 0, 31));
    expect(period.isLocked).toBe(false);

    await expect(reopenFiscalPeriod(period.id, wsUser.id, "manager-1")).rejects.toThrow(); // not closed yet

    const closed = await closeFiscalPeriod(period.id, wsUser.id, "manager-1");
    expect(closed.isLocked).toBe(true);
    expect(closed.lockedBy).toBe("manager-1");

    await expect(closeFiscalPeriod(period.id, wsUser.id, "manager-1")).rejects.toThrow(); // already closed

    const reopened = await reopenFiscalPeriod(period.id, wsUser.id, "manager-1");
    expect(reopened.isLocked).toBe(false);

    const log = await prisma.auditLog.findFirst({ where: { targetId: period.id, action: "fiscal_period_closed" } });
    expect(log).not.toBeNull();

    await prisma.accountingFiscalPeriod.delete({ where: { id: period.id } });
  });

  it("posting into a locked period is rejected by the ledger", async () => {
    const period = await createFiscalPeriod(wsUser.id, new Date(2018, 5, 1), new Date(2018, 5, 30));
    await closeFiscalPeriod(period.id, wsUser.id, "manager-1");

    await expect(
      postJournalEntry({
        workspaceUserId: wsUser.id,
        postedBy: "system",
        entryDate: new Date(2018, 5, 15),
        lines: [{ accountCode: "1000", debit: 100 }, { accountCode: "4000", credit: 100 }],
      })
    ).rejects.toThrow();

    await prisma.accountingFiscalPeriod.delete({ where: { id: period.id } });
  });
});
