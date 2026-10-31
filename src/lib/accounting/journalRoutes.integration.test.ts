import { afterAll, beforeAll, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/jwt";
import { GET, POST } from "@/app/api/accounting/journal-entries/route";
import { POST as reverse } from "@/app/api/accounting/journal-entries/[id]/route";

let owner: string, other: string;
function request(userId: string, body?: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/accounting/journal-entries", { method: body ? "POST" : "GET", headers: { cookie: `token=${signToken({ userId, role: "USER", plan: "BUSINESS" })}`, origin, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const body = { memo: "Local integration test", entryDate: "2026-10-31", lines: [{ accountCode: "1000", debit: 100, credit: 0 }, { accountCode: "4000", debit: 0, credit: 100 }] };
beforeAll(async () => {
  owner = (await prisma.user.create({ data: { email: `ledger-owner-${Date.now()}@example.test`, passwordHash: "x", plan: "BUSINESS", crmPlan: "SOLO" } })).id;
  other = (await prisma.user.create({ data: { email: `ledger-other-${Date.now()}@example.test`, passwordHash: "x", plan: "BUSINESS", crmPlan: "SOLO" } })).id;
});
afterAll(async () => {
  const ids = [owner, other].filter(Boolean);
  const entries = await prisma.accountingJournalEntry.findMany({ where: { workspaceUserId: { in: ids } }, select: { id: true } });
  await prisma.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entries.map(e => e.id) } } });
  await prisma.accountingJournalEntry.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.accountingAccount.deleteMany({ where: { workspaceUserId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});
it("posts a balanced real entry and scopes listing and reversal to its workspace", async () => {
  const created = await POST(request(owner, body)); expect(created.status).toBe(201);
  const { entry } = await created.json();
  const foreign = await GET(request(other)); expect((await foreign.json()).entries).toHaveLength(0);
  expect((await reverse(request(other, { action: "reverse" }), { params: Promise.resolve({ id: entry.id }) })).status).toBe(404);
  expect((await reverse(request(owner, { action: "reverse" }), { params: Promise.resolve({ id: entry.id }) })).status).toBe(200);
  const own = await GET(request(owner)); const entries = (await own.json()).entries;
  expect(entries).toHaveLength(2);
  expect(entries.some((r: { isReversed: boolean }) => r.isReversed)).toBe(true);
});
it("rejects forged-origin and unbalanced writes without creating a journal", async () => {
  const before = await prisma.accountingJournalEntry.count({ where: { workspaceUserId: owner } });
  expect((await POST(request(owner, body, "https://foreign.example"))).status).toBe(403);
  expect((await POST(request(owner, { ...body, lines: [{ accountCode: "1000", debit: 100, credit: 0 }, { accountCode: "4000", debit: 0, credit: 50 }] }))).status).toBe(400);
  expect(await prisma.accountingJournalEntry.count({ where: { workspaceUserId: owner } })).toBe(before);
});
