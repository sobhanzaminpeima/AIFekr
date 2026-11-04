import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/lib/repositories/userRepository";
import { expirePromoCredits, grantActivationBonus, saveFreeCreditsPolicy, signupCredits } from "./freeCredits";
import { deductCredits } from "@/lib/utils/teamCredits";

const ADMIN = `test-free-admin-${Date.now()}`;
const made: string[] = [];
let before: string | null = null;

beforeEach(async () => {
  before = before ?? ((await prisma.siteSetting.findUnique({ where: { key: "freeCreditsPolicy" } }))?.value ?? "");
});
afterAll(async () => {
  if (before) await prisma.siteSetting.update({ where: { key: "freeCreditsPolicy" }, data: { value: before } });
  else await prisma.siteSetting.deleteMany({ where: { key: "freeCreditsPolicy" } });
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: made } } });
  await prisma.auditLog.deleteMany({ where: { actorId: ADMIN } });
  await prisma.usageLog.deleteMany({ where: { userId: { in: made } } });
  await prisma.user.deleteMany({ where: { id: { in: made } } });
});

describe("free-credit policy", () => {
  it("keeps the previous sign-up amount while it is off", async () => {
    await saveFreeCreditsPolicy(ADMIN, { enabled: false });
    expect(await signupCredits(200)).toBe(200);
  });

  it("when on: 100 at sign-up and 50 once at activation, both expiring; the unspent rest is removed", async () => {
    await saveFreeCreditsPolicy(ADMIN, { enabled: true, signup: 100, activationBonus: 50, expiryDays: 14 });
    // The policy's start time must be before the account, so the bonus applies.
    await new Promise((r) => setTimeout(r, 20));
    expect(await signupCredits(200)).toBe(100);
    const user = await createUser({ name: "free credit test", phone: `+98900${Date.now().toString().slice(-7)}`, credits: await signupCredits(200) });
    made.push(user.id);
    await grantActivationBonus(user.id);
    await grantActivationBonus(user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(150);
    await deductCredits(user.id, 30);
    // 15 days later: 150 promo - 30 spent = 120 expire, nothing more.
    const result = await expirePromoCredits(new Date(Date.now() + 15 * 86400000));
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(0);
    const ledger = await prisma.creditLedgerEntry.aggregate({ where: { userId: user.id, teamId: null }, _sum: { delta: true } });
    expect(ledger._sum.delta).toBe(0);
    await expirePromoCredits(new Date(Date.now() + 16 * 86400000));
    expect((await prisma.creditLedgerEntry.count({ where: { userId: user.id, type: "PROMO_EXPIRED" } }))).toBe(2);
  });
});
