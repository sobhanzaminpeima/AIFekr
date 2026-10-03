import { BUSINESS_CODES } from "@/lib/plans/business";
import { describe, expect, it, vi, beforeEach } from "vitest";
const db = vi.hoisted(() => ({ packages: vi.fn(), industries: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: { findMany: db.packages }, industryPack: { findMany: db.industries } } }));
vi.mock("@/lib/utils/currency", () => ({ getFxRates: async () => ({ usdToToman:100000 }) }));
vi.mock("@/lib/utils/creditCosts", () => ({ getCreditCosts: vi.fn() }));
import { getPublicPlans, getPublicIndustries, parseFeatures } from "./data";

const plan = { planCode: "CRM_SOLO", name: "نام", nameEn: "Plus", price: 0, priceUsd: 1999, credits: 300, duration: 30, features: "فارسی", featuresEn: '["English feature"]', isFeatured: true, crmSeatLimit: null, teamSeatLimit: null };
beforeEach(() => { vi.clearAllMocks(); });
describe("public database boundary", () => {
  it("selects only active sale packages and public fields", async () => {
    db.packages.mockResolvedValue([plan]);
    const result = await getPublicPlans("en", true);
    expect(result?.[0]).toMatchObject({ price: 19.99, features: ["English feature"], credits: 300 });
    expect(db.packages.mock.calls[0][0].where.isActive).toBe(true);
    expect(db.packages.mock.calls[0][0].where.planCode.in).toContain("CRM_SOLO");
    expect(result?.[0]).not.toHaveProperty("userId");
  });
  it("does not label missing paid prices free", async () => {
    db.packages.mockResolvedValue([{ ...plan, priceUsd: null }]);
    expect((await getPublicPlans("en", true))?.[0].price).toBeNull();
  });
  it("uses the same USD price basis across public languages", async () => {
    db.packages.mockResolvedValue([{ ...plan, planCode: "CRM_SOLO", price: 1490000 }]);
    expect((await getPublicPlans("fa", true))?.[0].price).toBe(19.99);
  });
  it("keeps database English fallback for German and Turkish", async () => {
    db.packages.mockResolvedValue([plan]);
    for (const lang of ["de", "tr"] as const) expect((await getPublicPlans(lang, true))?.[0].features).toEqual(["English feature"]);
  });
  it("never invents fallback plans when the database fails", async () => {
    db.packages.mockRejectedValue(new Error("offline"));
    expect(await getPublicPlans("en", true)).toBeNull();
  });
  it("uses real CRM and team package codes", async () => {
    db.packages.mockResolvedValue([]);
    await getPublicPlans("en", true);
    expect(db.packages.mock.calls[0][0].where.planCode.in).toEqual([...BUSINESS_CODES, "CRM_SOLO", "CRM_TEAM", "TEAM_STARTER", "TEAM_GROWTH"]);
  });
  it("handles missing industries without fake records", async () => {
    db.industries.mockRejectedValue(new Error("offline"));
    expect(await getPublicIndustries()).toEqual([]);
  });
  it("safely parses supported feature formats", () => {
    expect(parseFeatures('["one", 2, "two"]')).toEqual(["one", "two"]);
    expect(parseFeatures("one\n two ")).toEqual(["one", "two"]);
    expect(parseFeatures("[broken")).toEqual([]);
    expect(parseFeatures(null)).toEqual([]);
  });
});
