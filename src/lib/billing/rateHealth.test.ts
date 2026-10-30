import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ rates: {} as Record<string, { validUntil: Date } | null>, packages: [] as Record<string, unknown>[] }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    package: { findMany: vi.fn(async () => m.packages) },
    billingExchangeRate: { findFirst: vi.fn(async ({ where }: { where: { target: string } }) => m.rates[where.target] ?? null) },
  },
}));
import { rateHealth } from "./rateHealth";

const now = new Date("2026-10-30T12:00:00Z");
const fixedAll = { planCode: "BIZ", baseCurrency: "USD", termPrices: '{"monthly":11900}', entitlements: JSON.stringify({ fixedPrices: { IRT: { monthly: 31178000 }, TRY: { monthly: 587731 } } }) };
beforeEach(() => { m.rates = {}; m.packages = [fixedAll]; });

describe("rateHealth", () => {
  it("flags an expired toman rate but no blocked package when every package has a fixed toman price", async () => {
    m.rates.IRT = { validUntil: new Date("2026-10-18T15:02:00Z") };
    const irt = (await rateHealth(now)).find((r) => r.target === "IRT")!;
    expect(irt).toMatchObject({ status: "expired", blocked: [] });
  });
  it("names the packages a buyer cannot pay for without a valid rate", async () => {
    m.packages = [fixedAll, { planCode: "NEW", baseCurrency: "USD", termPrices: '{"monthly":5000,"quarterly":13000}', entitlements: JSON.stringify({ fixedPrices: { IRT: { monthly: 1 } } }) }];
    const irt = (await rateHealth(now)).find((r) => r.target === "IRT")!;
    expect(irt.blocked).toEqual(["NEW"]);
  });
  it("warns 48 hours ahead and is quiet while a rate is valid", async () => {
    m.rates.TRY = { validUntil: new Date(now.getTime() + 24 * 3600000) };
    m.rates.IRT = { validUntil: new Date(now.getTime() + 5 * 24 * 3600000) };
    const r = await rateHealth(now);
    expect(r.find((x) => x.target === "TRY")!.status).toBe("expiring");
    expect(r.find((x) => x.target === "IRT")!.status).toBe("ok");
  });
  it("a package priced in the currency itself never needs the rate", async () => {
    m.packages = [{ planCode: "CHAT", baseCurrency: "IRT", termPrices: '{"monthly":199000}', entitlements: "{}" }];
    expect((await rateHealth(now)).find((r) => r.target === "IRT")!.blocked).toEqual([]);
  });
});
