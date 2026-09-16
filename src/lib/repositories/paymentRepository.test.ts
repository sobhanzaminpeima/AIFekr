import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createPendingPayment, findPaymentById, activatePlanForPayment } from "./paymentRepository";

// Integration test against the dev SQLite DB; rows are scoped to this file.
const USER_ID = `test-payment-period-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
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
