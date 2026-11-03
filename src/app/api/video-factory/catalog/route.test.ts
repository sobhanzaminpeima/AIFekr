import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ lang: "en", findMany: vi.fn() }));
vi.mock("@/lib/video-factory/http", () => ({ factoryRoute: (_req: unknown, _admin: boolean, run: () => Promise<Response>) => run() }));
vi.mock("@/lib/video-factory/config", () => ({ getPolicy: async () => ({ silentOnly: false, providers: {} }) }));
vi.mock("@/lib/video-factory/resources", () => ({ listResources: async () => [] }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => m.lang }));
// Approved rates expired (production on 2026-11-03): only fixed prices can be used.
vi.mock("@/lib/billing/rates", () => ({ currencyConvert: async () => { throw Error("APPROVED_RATE_REQUIRED"); } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: { findMany: m.findMany }, videoFactoryProvider: { findMany: async () => [] } } }));
import { GET } from "./route";

const tomanOnly = { planCode: "VF_CREATOR_5", name: "پنج ویدیو", nameEn: "Five videos", price: 0, priceUsd: null, priceTry: null, duration: 30, baseCurrency: "IRT", termPrices: '{"monthly":4250000}', credits: 500, creditAllocation: "PER_PURCHASE", entitlements: '{"limits":{"compareAtToman":7000000}}', publicationStatus: "PUBLISHED" };
const usdFixed = { ...tomanOnly, planCode: "VF_STARTER", baseCurrency: "USD", priceUsd: 6999, termPrices: '{"monthly":6999}', entitlements: '{"fixedPrices":{"IRT":{"monthly":18337380},"TRY":{"monthly":345681}}}' };
const packages = async () => (await (await GET(new NextRequest("http://localhost/api/video-factory/catalog"))).json()).packages as { planCode: string; offer: { minor: number; currency: string; compareAtMinor?: number } }[];
beforeEach(() => { m.findMany.mockReset(); m.findMany.mockResolvedValue([tomanOnly, usdFixed]); });

it("asks only for published, visible, non-retired packages", async () => {
  await packages();
  expect(m.findMany.mock.calls[0][0].where).toMatchObject({ category: "VIDEO_FACTORY", isActive: true, publicationStatus: "PUBLISHED", publicVisible: true, planCode: { notIn: ["CHAT_STARTER_30"] } });
});
it("prices each package in the visitor's currency, like the landing", async () => {
  m.lang = "fa";
  expect((await packages()).map((p) => [p.planCode, p.offer.minor, p.offer.currency, p.offer.compareAtMinor])).toEqual([["VF_CREATOR_5", 4250000, "IRT", 7000000], ["VF_STARTER", 18337380, "IRT", undefined]]);
  m.lang = "tr";
  expect((await packages()).map((p) => [p.planCode, p.offer.minor, p.offer.currency])).toEqual([["VF_STARTER", 345681, "TRY"]]);
});
it("leaves out a package with no price in the visitor's currency instead of showing Toman", async () => {
  m.lang = "en";
  expect((await packages()).map((p) => [p.planCode, p.offer.currency])).toEqual([["VF_STARTER", "USD"]]);
});
