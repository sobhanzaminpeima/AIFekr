import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { deductCredits, refundCredits, chargeAndLog } from "@/lib/utils/teamCredits";
import { createUser } from "@/lib/repositories/userRepository";
import { updateUserAsAdmin } from "@/lib/repositories/adminRepository";
import { activatePlanForPayment, createPendingPayment } from "@/lib/repositories/paymentRepository";
import { ledgerDrift } from "./ledger";

/**
 * Integration tests against the dev SQLite database (same pattern as
 * teamCredits.test.ts): every row is scoped to ids unique to this file and
 * removed afterwards. The property under test: every change to a balance
 * leaves exactly one ledger row, so balance == sum of the ledger.
 */
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const USER_ID = `test-ledger-user-${SUFFIX}`;
const OWNER_ID = `test-ledger-owner-${SUFFIX}`;
const ADMIN_ID = `test-ledger-admin-${SUFFIX}`;
const created: string[] = [];

const entries = (userId = USER_ID) => prisma.creditLedgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
const balance = async (userId = USER_ID) => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits;

/** Resets the user and records the reset as its opening balance, like the backfill does. */
async function resetUser(credits: number) {
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: USER_ID } });
  await prisma.usageLog.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.upsert({ where: { id: USER_ID }, create: { id: USER_ID, name: "ledger test", credits }, update: { credits } });
  await prisma.creditLedgerEntry.create({ data: { userId: USER_ID, delta: credits, balanceAfter: credits, type: "OPENING_BALANCE" } });
}

beforeEach(() => resetUser(100));

afterAll(async () => {
  const ids = [USER_ID, OWNER_ID, ADMIN_ID, ...created];
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: ids } } });
  await prisma.usageLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.team.deleteMany({ where: { ownerId: OWNER_ID } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

async function driftOf(userId = USER_ID) {
  return (await ledgerDrift(prisma)).find((w) => w.userId === userId && !w.teamId)?.drift;
}

describe("credit ledger", () => {
  it("records a spend with its balance and nothing for a declined one", async () => {
    expect(await deductCredits(USER_ID, 30, prisma, "DEFAULT", { module: "test" })).toBe(true);
    expect(await deductCredits(USER_ID, 500)).toBe(false);
    const rows = (await entries()).filter((e) => e.type === "SPEND");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ delta: -30, balanceAfter: 70, module: "test", teamId: null });
    expect(await driftOf()).toBe(0);
  });

  it("records refunds, which UsageLog never did", async () => {
    await deductCredits(USER_ID, 40);
    await refundCredits(USER_ID, 40, prisma, { module: "music" });
    expect((await entries()).map((e) => [e.type, e.delta])).toEqual([["OPENING_BALANCE", 100], ["SPEND", -40], ["REFUND", 40]]);
    expect(await driftOf()).toBe(0);
  });

  it("links a chargeAndLog spend to its usage row, provider and feature", async () => {
    await chargeAndLog(USER_ID, 2, { type: "tool", provider: "gemini", model: "m1", metadata: { feature: "seo.analyze" } });
    const log = await prisma.usageLog.findFirstOrThrow({ where: { userId: USER_ID } });
    const row = (await entries()).find((e) => e.type === "SPEND")!;
    expect(row).toMatchObject({ delta: -2, usageLogId: log.id, operationId: `usage:${log.id}`, module: "seo.analyze", provider: "gemini", model: "m1" });
  });

  it("keeps ledger and balance equal under concurrent charges", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => chargeAndLog(USER_ID, 20, { type: "chat" })));
    const wins = results.filter(Boolean).length;
    expect(wins).toBe(5);
    expect(await balance()).toBe(0);
    expect((await entries()).filter((e) => e.type === "SPEND")).toHaveLength(wins);
    expect(await driftOf()).toBe(0);
  }, 30_000);

  it("records a team member's spend against the team wallet", async () => {
    await prisma.user.upsert({ where: { id: OWNER_ID }, create: { id: OWNER_ID, name: "ledger owner", credits: 0 }, update: {} });
    const team = await prisma.team.create({ data: { name: "ledger team", ownerId: OWNER_ID, credits: 50 } });
    await prisma.teamMember.create({ data: { teamId: team.id, userId: USER_ID, role: "MEMBER" } });
    try {
      expect(await deductCredits(USER_ID, 10)).toBe(true);
      const row = (await entries()).find((e) => e.type === "SPEND")!;
      expect(row).toMatchObject({ teamId: team.id, delta: -10, balanceAfter: 40 });
      expect(await balance()).toBe(100);
    } finally {
      await prisma.teamMember.deleteMany({ where: { userId: USER_ID } });
    }
  });

  it("records the starting credits of a new account", async () => {
    const user = await createUser({ name: "ledger signup", credits: 200 });
    created.push(user.id);
    expect((await entries(user.id)).map((e) => [e.type, e.delta, e.balanceAfter])).toEqual([["SIGNUP_GRANT", 200, 200]]);
    expect(await driftOf(user.id)).toBe(0);
  });

  it("grants a credit purchase exactly once", async () => {
    const payment = await createPendingPayment({ userId: USER_ID, amount: 1000, plan: "CREDITS_TEST", gateway: "zarinpal" });
    const withUser = { ...payment, user: await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } }) };
    await activatePlanForPayment(withUser, "ref", "auth", { credits: 600, days: 30 });
    await activatePlanForPayment(withUser, "ref", "auth", { credits: 600, days: 30 });
    expect(await balance()).toBe(700);
    expect((await entries()).filter((e) => e.type === "PURCHASE")).toMatchObject([{ delta: 600, paymentId: payment.id, operationId: `payment:${payment.id}` }]);
    expect(await driftOf()).toBe(0);
  });
});

describe("admin credit changes", () => {
  it("applies a delta with a reason and records who made it", async () => {
    await updateUserAsAdmin(USER_ID, { creditDelta: 25, creditReason: "support goodwill" }, ADMIN_ID);
    expect(await balance()).toBe(125);
    expect((await entries()).at(-1)).toMatchObject({ type: "ADMIN_ADJUSTMENT", delta: 25, actorId: ADMIN_ID, reason: "support goodwill" });
  });

  it("refuses a change without a reason, and a removal larger than the balance", async () => {
    await expect(updateUserAsAdmin(USER_ID, { creditDelta: 5 }, ADMIN_ID)).rejects.toThrow("CREDIT_REASON_REQUIRED");
    await expect(updateUserAsAdmin(USER_ID, { creditDelta: -101, creditReason: "test" }, ADMIN_ID)).rejects.toThrow("INSUFFICIENT_CREDITS");
    expect(await balance()).toBe(100);
    expect((await entries()).filter((e) => e.type === "ADMIN_ADJUSTMENT")).toHaveLength(0);
  });

  it("turns a legacy absolute value into the matching delta", async () => {
    await deductCredits(USER_ID, 10);
    await updateUserAsAdmin(USER_ID, { credits: 300 }, ADMIN_ID);
    expect(await balance()).toBe(300);
    expect((await entries()).at(-1)).toMatchObject({ type: "ADMIN_ADJUSTMENT", delta: 210 });
    expect(await driftOf()).toBe(0);
  });
});
