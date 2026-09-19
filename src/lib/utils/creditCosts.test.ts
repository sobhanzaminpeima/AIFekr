import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getCreditCosts } from "./creditCosts";
import { CREDIT_COSTS } from "./credits";

const SETTING_KEY = "creditCosts";

afterEach(async () => {
  await prisma.siteSetting.deleteMany({ where: { key: SETTING_KEY } });
});

describe("getCreditCosts", () => {
  it("returns the hardcoded defaults when no admin override exists", async () => {
    expect(await getCreditCosts()).toMatchObject(CREDIT_COSTS);
  });

  it("merges a partial admin override over the defaults", async () => {
    await prisma.siteSetting.create({ data: { key: SETTING_KEY, value: JSON.stringify({ chat: 3, image_hd: 25 }) } });
    const costs = await getCreditCosts();
    expect(costs.chat).toBe(3);
    expect(costs.image_hd).toBe(25);
    expect(costs.image_standard).toBe(CREDIT_COSTS.image_standard);
    expect(costs.video_30s).toBe(CREDIT_COSTS.video_30s);
  });

  it("falls back to defaults when the stored value is malformed JSON", async () => {
    await prisma.siteSetting.create({ data: { key: SETTING_KEY, value: "not json" } });
    expect(await getCreditCosts()).toMatchObject(CREDIT_COSTS);
  });
});
