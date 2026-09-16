import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getAvailableCredits, deductCredits, refundCredits, chargeAndLog } from "./teamCredits";

/**
 * Integration tests against the real (dev) SQLite database, following the
 * same pattern as ledger.test.ts. Every row is scoped to ids unique to this
 * file and torn down afterwards, so it never touches real data.
 *
 * These cover the guarantees this module is responsible for and that a
 * regression would cost real money: never overdraw a balance, never charge
 * without recording usage, never record usage without charging.
 */

const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SOLO_ID = `test-credits-solo-${SUFFIX}`;
const TEAM_OWNER_ID = `test-credits-owner-${SUFFIX}`;

async function resetSoloUser(credits: number) {
  await prisma.user.upsert({
    where: { id: SOLO_ID },
    create: { id: SOLO_ID, name: "credit test solo", credits },
    update: { credits },
  });
}

beforeEach(async () => {
  // Usage rows accumulate across cases in this file, so the per-test
  // assertions about log counts need a clean slate, not just a reset balance.
  await prisma.usageLog.deleteMany({ where: { userId: SOLO_ID } });
  await resetSoloUser(100);
});

afterAll(async () => {
  await prisma.usageLog.deleteMany({ where: { userId: { in: [SOLO_ID, TEAM_OWNER_ID] } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: [SOLO_ID, TEAM_OWNER_ID] } } });
  await prisma.team.deleteMany({ where: { ownerId: TEAM_OWNER_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [SOLO_ID, TEAM_OWNER_ID] } } });
});

describe("deductCredits", () => {
  it("deducts when the balance covers the charge", async () => {
    expect(await deductCredits(SOLO_ID, 30)).toBe(true);
    expect(await getAvailableCredits(SOLO_ID)).toBe(70);
  });

  it("refuses the charge instead of going negative", async () => {
    expect(await deductCredits(SOLO_ID, 101)).toBe(false);
    expect(await getAvailableCredits(SOLO_ID)).toBe(100);
  });

  it("allows spending the balance down to exactly zero", async () => {
    expect(await deductCredits(SOLO_ID, 100)).toBe(true);
    expect(await getAvailableCredits(SOLO_ID)).toBe(0);
    expect(await deductCredits(SOLO_ID, 1)).toBe(false);
  });

  it("never lets concurrent charges overdraw the balance", async () => {
    // The bug this guards: balance check and decrement used to be separate
    // awaits, so simultaneous requests both passed the check and the balance
    // went negative. Ten parallel 20-credit charges against 100 credits must
    // settle as exactly five winners and zero remaining.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => deductCredits(SOLO_ID, 20))
    );

    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await getAvailableCredits(SOLO_ID)).toBe(0);
  });

  it("treats a zero or negative amount as a no-op success", async () => {
    expect(await deductCredits(SOLO_ID, 0)).toBe(true);
    expect(await getAvailableCredits(SOLO_ID)).toBe(100);
  });
});

describe("refundCredits", () => {
  it("returns credits to the balance", async () => {
    await deductCredits(SOLO_ID, 40);
    await refundCredits(SOLO_ID, 40);
    expect(await getAvailableCredits(SOLO_ID)).toBe(100);
  });
});

describe("chargeAndLog", () => {
  it("writes exactly one usage row for a successful charge", async () => {
    const charged = await chargeAndLog(SOLO_ID, 25, {
      type: "image",
      model: "test-model",
      metadata: { style: "realistic" },
    });

    expect(charged).toBe(true);
    expect(await getAvailableCredits(SOLO_ID)).toBe(75);

    const logs = await prisma.usageLog.findMany({ where: { userId: SOLO_ID } });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("image");
    expect(logs[0].credits).toBe(25);
    expect(logs[0].model).toBe("test-model");
    expect(JSON.parse(logs[0].metadata!)).toEqual({ style: "realistic" });
  });

  it("persists provider/token fields and computes estimatedCostUsd from AiModelPricing", async () => {
    await prisma.aiModelPricing.upsert({
      where: { providerId_kind: { providerId: "test-charge-provider", kind: "chat" } },
      update: { inputPricePerMillion: 2, outputPricePerMillion: 8, isActive: true },
      create: { providerId: "test-charge-provider", kind: "chat", inputPricePerMillion: 2, outputPricePerMillion: 8 },
    });

    const charged = await chargeAndLog(SOLO_ID, 5, {
      type: "chat",
      provider: "test-charge-provider",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });

    expect(charged).toBe(true);
    const logs = await prisma.usageLog.findMany({ where: { userId: SOLO_ID } });
    expect(logs).toHaveLength(1);
    expect(logs[0].provider).toBe("test-charge-provider");
    expect(logs[0].inputTokens).toBe(1_000_000);
    expect(logs[0].outputTokens).toBe(500_000);
    expect(logs[0].estimatedCostUsd).toBeCloseTo(6, 6);

    await prisma.aiModelPricing.delete({ where: { providerId_kind: { providerId: "test-charge-provider", kind: "chat" } } });
  });

  it("leaves estimatedCostUsd null when an explicit value isn't given and no provider is set", async () => {
    const charged = await chargeAndLog(SOLO_ID, 5, { type: "chat" });
    expect(charged).toBe(true);
    const log = await prisma.usageLog.findFirst({ where: { userId: SOLO_ID, type: "chat" }, orderBy: { createdAt: "desc" } });
    expect(log?.estimatedCostUsd).toBeNull();
  });

  it("writes no usage row when the charge is declined", async () => {
    const charged = await chargeAndLog(SOLO_ID, 500, { type: "video" });

    expect(charged).toBe(false);
    expect(await getAvailableCredits(SOLO_ID)).toBe(100);
    expect(await prisma.usageLog.count({ where: { userId: SOLO_ID } })).toBe(0);
  });

  it("keeps charge and usage row consistent under concurrency", async () => {
    // Whatever the interleaving, the credits spent must equal the credits
    // recorded — a charge without a log (or a log without a charge) is the
    // exact drift this transaction exists to prevent.
    await Promise.all(Array.from({ length: 8 }, () => chargeAndLog(SOLO_ID, 20, { type: "chat" })));

    const logs = await prisma.usageLog.findMany({ where: { userId: SOLO_ID } });
    const logged = logs.reduce((sum, l) => sum + l.credits, 0);
    const spent = 100 - (await getAvailableCredits(SOLO_ID));

    expect(logged).toBe(spent);
  });
});

describe("team credit pooling", () => {
  it("charges the shared team pool for a member, not the member's own balance", async () => {
    await prisma.user.upsert({
      where: { id: TEAM_OWNER_ID },
      create: { id: TEAM_OWNER_ID, name: "credit test owner", credits: 999 },
      update: { credits: 999 },
    });
    const team = await prisma.team.create({
      data: { name: `credit-test-team-${SUFFIX}`, ownerId: TEAM_OWNER_ID, credits: 50 },
    });
    await prisma.teamMember.create({ data: { userId: TEAM_OWNER_ID, teamId: team.id, role: "OWNER" } });

    expect(await getAvailableCredits(TEAM_OWNER_ID)).toBe(50);
    expect(await deductCredits(TEAM_OWNER_ID, 30)).toBe(true);
    expect(await getAvailableCredits(TEAM_OWNER_ID)).toBe(20);

    // Declined against the pool even though the user row has 999 credits.
    expect(await deductCredits(TEAM_OWNER_ID, 21)).toBe(false);

    const owner = await prisma.user.findUnique({ where: { id: TEAM_OWNER_ID }, select: { credits: true } });
    expect(owner!.credits).toBe(999);
  });
});
