import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { voiceAccess } from "./service";

const ID = `test-voice-paid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const free = { role: "USER", plan: "FREE", planExpiry: null };
const policy = (paidAccess: boolean) => ({ allowedPlans: ["PRO"], paidAccess });

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { userId: ID } });
  await prisma.user.deleteMany({ where: { id: ID } });
});

describe("voiceAccess", () => {
  it("opens the studio to a paying customer only when paidAccess is on", async () => {
    await prisma.user.create({ data: { id: ID, name: "voice paid test" } });
    expect(await voiceAccess(ID, free, policy(true))).toBe(false);
    await prisma.payment.create({ data: { userId: ID, amount: 1000, plan: "CREDITS_TEST", gateway: "zarinpal", status: "FAILED" } });
    expect(await voiceAccess(ID, free, policy(true))).toBe(false);
    await prisma.payment.create({ data: { userId: ID, amount: 1000, plan: "CREDITS_TEST", gateway: "zarinpal", status: "SUCCESS" } });
    expect(await voiceAccess(ID, free, policy(false))).toBe(false);
    expect(await voiceAccess(ID, free, policy(true))).toBe(true);
  });
});
