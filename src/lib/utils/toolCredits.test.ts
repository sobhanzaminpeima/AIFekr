import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { reserveToolCredits } from "./toolCredits";
import { toolCostKey } from "./credits";

const P = `toolcr${Date.now().toString(36)}`;
const userId = `${P}u`;

const credits = async () => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits;

beforeEach(async () => {
  await prisma.user.create({ data: { id: userId, name: "t", credits: 5 } });
});

afterEach(async () => {
  await prisma.usageLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("reserveToolCredits", () => {
  it("charges the tool cost and records a usage row", async () => {
    const r = await reserveToolCredits(userId, "seo.analyze", { cost: 2 });
    expect(r.ok).toBe(true);
    expect(await credits()).toBe(3);
    const log = await prisma.usageLog.findFirstOrThrow({ where: { userId } });
    expect(log.type).toBe("tool");
    expect(log.credits).toBe(2);
  });

  it("refuses with 402 and charges nothing when the balance is too low", async () => {
    const r = await reserveToolCredits(userId, "seo.analyze", { cost: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(402);
    expect(await credits()).toBe(5);
    expect(await prisma.usageLog.count({ where: { userId } })).toBe(0);
  });

  it("gives the credits back when the work fails, and only once", async () => {
    const r = await reserveToolCredits(userId, "ceo.question", { cost: 2 });
    if (!r.ok) throw new Error("expected ok");
    await r.release();
    await r.release();
    expect(await credits()).toBe(5);
  });

  it("cannot be overspent by concurrent requests", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => reserveToolCredits(userId, "x", { cost: 2 })));
    expect(results.filter((r) => r.ok)).toHaveLength(2); // 5 credits => exactly two 2-credit calls
    expect(await credits()).toBe(1);
  });

  it("uses the admin-set price of that feature, and the general tool price for the others", async () => {
    await prisma.siteSetting.upsert({
      where: { key: "creditCosts" }, create: { key: "creditCosts", value: JSON.stringify({ [toolCostKey("website-designer")]: 4 }) },
      update: { value: JSON.stringify({ [toolCostKey("website-designer")]: 4 }) },
    });
    await prisma.user.update({ where: { id: userId }, data: { credits: 10 } });
    try {
      const a = await reserveToolCredits(userId, "website-designer");
      expect(a.ok && a.credits).toBe(4);
      const b = await reserveToolCredits(userId, "seo.analyze");
      expect(b.ok && b.credits).toBe(2);
      expect(await credits()).toBe(4); // 10 - 4 - 2
    } finally {
      await prisma.siteSetting.deleteMany({ where: { key: "creditCosts" } });
    }
  });
});
