import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createPendingPayment, findPaymentById, activatePlanForPayment } from "./paymentRepository";

// Integration test against the dev SQLite DB; rows are scoped to this file.
const USER_ID = `test-payment-period-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

// Student activation attaches the "university" industry pack, which the
// production seed creates; the freshly migrated test DB has no seed data.
beforeAll(async () => {
  await prisma.industryPack.upsert({
    where: { slug: "university" },
    update: {},
    create: { slug: "university", name: "دانشگاه", emoji: "🎓", tagline: "", valueProposition: "", targetCustomers: "[]", painPoints: "[]", agents: "[]", outcomes: "[]", kpis: "[]", color: "#ea580c", gradientFrom: "#ea580c", gradientTo: "#ea580c" },
  });
});

afterAll(async () => {
  await prisma.walletTransaction.deleteMany({ where: { userId: { in: [USER_ID, `${USER_ID}-race`, `${USER_ID}-replay`] } } });
  await prisma.payment.deleteMany({ where: { userId: { in: [USER_ID, `${USER_ID}-race`, `${USER_ID}-replay`] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, `${USER_ID}-race`, `${USER_ID}-replay`] } } });
});

async function activate(periodMonths: number | undefined) {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: { id: USER_ID, name: "payment period test" },
    update: { plan: "FREE", planExpiry: null },
  });
  const pending = await createPendingPayment({ userId: USER_ID, amount: 1000, plan: "PRO", gateway: "zarinpal", periodMonths });
  const payment = await findPaymentById(pending.id);
  return activatePlanForPayment(payment!, "ref", `auth-${pending.id}`, { credits: 0, days: 30 });
}

describe("activatePlanForPayment billing term", () => {
  it("grants a replayed credit top-up and its wallet debit exactly once", async () => {
    const userId = `${USER_ID}-replay`;
    await prisma.user.create({ data: { id: userId, credits: 0, walletBalance: 500 } });
    const pending = await createPendingPayment({ userId, amount: 1000, plan: "CREDITS_test", gateway: "zarinpal", walletDiscountToman: 200 });
    const payment = await findPaymentById(pending.id);
    // Parallel replays of the same gateway callback, e.g. a re-submitted return URL.
    await Promise.allSettled(Array.from({ length: 5 }, () => activatePlanForPayment(payment!, "replay-ref", `auth-${pending.id}`, { credits: 300, days: 0 })));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.credits).toBe(300);
    expect(user.walletBalance).toBe(300);
    expect(await prisma.walletTransaction.count({ where: { relatedPaymentId: pending.id } })).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("SUCCESS");
  });
  it("grants student credits once, enables the module and gives exactly 60 days", async () => {
    await prisma.user.upsert({ where: { id: USER_ID }, create: { id: USER_ID, credits: 0 }, update: { credits: 0, plan: "FREE" } });
    const pending = await createPendingPayment({ userId: USER_ID, amount: 6272000, plan: "STUDENT_FIRST_TWO_MONTHS", gateway: "zarinpal", periodMonths: 2 });
    const payment = await findPaymentById(pending.id);
    const expiry = await activatePlanForPayment(payment!, "student-ref", `auth-${pending.id}`, { credits: 1000, days: 30 });
    await activatePlanForPayment(payment!, "student-ref", `auth-${pending.id}`, { credits: 1000, days: 30 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } });
    expect(user.credits).toBe(1000);
    expect(user.plan).toBe("STUDENT_FIRST_TWO_MONTHS");
    expect(Math.round((expiry.getTime() - Date.now()) / DAY_MS)).toBe(60);
    const accessOverride = await prisma.userModuleOverride.findUnique({ where: { userId_moduleKey: { userId: USER_ID, moduleKey: "student.workspace" } } });
    expect(accessOverride?.enabled).toBe(true);
  });
  it("does not create two introductory payments concurrently", async () => {
    const userId = `${USER_ID}-race`;
    await prisma.user.create({ data: { id: userId } });
    const attempts = await Promise.allSettled([1, 2].map(() => createPendingPayment({ userId, amount: 13071970, plan: "STUDENT_FIRST_TWO_MONTHS", gateway: "zarinpal", periodMonths: 2 })));
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.payment.count({ where: { userId, plan: "STUDENT_FIRST_TWO_MONTHS" } })).toBe(1);
  });
  it("activates the regular student subscription for 30 days once", async () => {
    await prisma.user.update({ where: { id: USER_ID }, data: { credits: 0 } });
    const pending = await createPendingPayment({ userId: USER_ID, amount: 13071970, plan: "STUDENT_MONTHLY", gateway: "zarinpal", periodMonths: 1 });
    const payment = await findPaymentById(pending.id);
    const expiry = await activatePlanForPayment(payment!, "monthly-ref", `auth-${pending.id}`, { credits: 1000, days: 30 });
    await activatePlanForPayment(payment!, "monthly-ref", `auth-${pending.id}`, { credits: 1000, days: 30 });
    expect(Math.round((expiry.getTime() - Date.now()) / DAY_MS)).toBe(30);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).credits).toBe(1000);
  });
  it("activates a renewable quarterly student plan for 90 days with credits only once", async () => {
    await prisma.user.update({where:{id:USER_ID},data:{credits:0}});
    const pending=await createPendingPayment({userId:USER_ID,amount:1000,plan:"STUDENT_QUARTERLY",gateway:"zarinpal",periodMonths:3});
    const payment=await findPaymentById(pending.id);
    const expiry=await activatePlanForPayment(payment!,"quarterly-ref",`auth-${pending.id}`,{credits:1000,days:90});
    await activatePlanForPayment(payment!,"quarterly-ref",`auth-${pending.id}`,{credits:1000,days:90});
    expect(Math.round((expiry.getTime()-Date.now())/DAY_MS)).toBe(90);
    expect((await prisma.user.findUniqueOrThrow({where:{id:USER_ID}})).credits).toBe(1000);
  });
  it("grants one package duration for a monthly payment", async () => {
    const expiry = await activate(undefined);
    expect(Math.round((expiry.getTime() - Date.now()) / DAY_MS)).toBe(30);
  });

  it("grants twelve package durations for an annual payment", async () => {
    // Regression: annual used to charge the annual price and grant 30 days.
    const expiry = await activate(12);
    expect(Math.round((expiry.getTime() - Date.now()) / DAY_MS)).toBe(360);

    const user = await prisma.user.findUnique({ where: { id: USER_ID }, select: { plan: true, planExpiry: true } });
    expect(user!.plan).toBe("PRO");
    expect(user!.planExpiry!.getTime()).toBe(expiry.getTime());
  });
});
