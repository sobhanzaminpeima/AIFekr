import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { chargeNextMinute, hasFreeMinute, realtimeInstructions } from "./realtime";

const USER = `test-live-rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const balance = async () => (await prisma.user.findUniqueOrThrow({ where: { id: USER } })).credits;
async function session(freeMinute: boolean) {
  return prisma.liveVoiceSession.create({ data: { userId: USER, providerSessionId: `live_test_${Math.random().toString(36).slice(2)}`, freeMinute, creditsPerMinute: 66, maxSeconds: 600 } });
}

beforeEach(async () => {
  await prisma.liveVoiceSession.deleteMany({ where: { userId: USER } });
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: USER } });
  await prisma.usageLog.deleteMany({ where: { userId: USER } });
  await prisma.user.upsert({ where: { id: USER }, create: { id: USER, name: "live rt test", credits: 150 }, update: { credits: 150 } });
});
afterAll(async () => {
  await prisma.liveVoiceSession.deleteMany({ where: { userId: USER } });
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: USER } });
  await prisma.usageLog.deleteMany({ where: { userId: USER } });
  await prisma.user.deleteMany({ where: { id: USER } });
});

describe("AIFekr Live live-mode billing", () => {
  it("gives the free first minute once, then charges every started minute through the ledger", async () => {
    expect(await hasFreeMinute(USER)).toBe(true);
    const s = await session(true);
    expect(await hasFreeMinute(USER)).toBe(false);
    expect(await chargeNextMinute(s.id)).toBe(true);
    expect(await balance()).toBe(150);
    expect(await chargeNextMinute(s.id)).toBe(true);
    expect(await balance()).toBe(84);
    const row = await prisma.liveVoiceSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(row).toMatchObject({ chargedMinutes: 2, chargedCredits: 66 });
    const ledger = await prisma.creditLedgerEntry.findMany({ where: { userId: USER, type: "SPEND" } });
    expect(ledger.map((e) => [e.delta, e.module])).toEqual([[-66, "live.realtime"]]);
  });

  it("refuses a minute the balance cannot pay and does not count it", async () => {
    const s = await session(false);
    expect(await chargeNextMinute(s.id)).toBe(true);
    expect(await chargeNextMinute(s.id)).toBe(true);
    expect(await chargeNextMinute(s.id)).toBe(false);
    expect(await balance()).toBe(18);
    expect((await prisma.liveVoiceSession.findUniqueOrThrow({ where: { id: s.id } })).chargedMinutes).toBe(2);
  });

  it("charges a minute once even when two processes reach it together", async () => {
    const s = await session(false);
    await Promise.all([chargeNextMinute(s.id), chargeNextMinute(s.id)]);
    expect(await balance()).toBe(84);
    expect((await prisma.liveVoiceSession.findUniqueOrThrow({ where: { id: s.id } })).chargedMinutes).toBe(1);
  });

  it("never charges a closed session", async () => {
    const s = await session(false);
    await prisma.liveVoiceSession.update({ where: { id: s.id }, data: { status: "CLOSED" } });
    expect(await chargeNextMinute(s.id)).toBe(false);
    expect(await balance()).toBe(150);
  });

  it("tells the model the user's language and how to say the name", () => {
    expect(realtimeInstructions("fa")).toMatch(/start in Persian/);
    expect(realtimeInstructions("en")).toMatch(/English question gets an English answer/);
    expect(realtimeInstructions("fa")).toContain("ای آی فکر لایو");
  });
});
