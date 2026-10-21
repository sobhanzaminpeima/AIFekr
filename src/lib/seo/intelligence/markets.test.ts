import { describe, it, expect } from "vitest";
import { parseSeoMarkets, marketSupports } from "./markets";
import { seoRequestSchema } from "./provider";
describe("provider-supported SEO markets", () => {
  it("uses provider location/language coverage without inferring UI language", () => { const markets = parseSeoMarkets({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ location_code: 2840, location_name: "United States", available_languages: [{ language_code: "en", language_name: "English" }] }] }] }); expect(markets[0].available_languages).toEqual([{ language_code: "en", language_name: "English" }]); });
  it("rejects failed or malformed coverage instead of inventing countries", () => { expect(() => parseSeoMarkets({ status_code: 20000, tasks: [{ status_code: 40101, result: [] }] })).toThrow(); });
  it("enforces platform-specific coverage before any billable task", () => { const markets = [{ location_code: 2840, location_name: "United States", available_languages: [{ language_code: "en", language_name: "English", available_platforms: ["google"] }] }]; const input = seoRequestSchema.parse({ action: "aiVisibility", platform: "chat_gpt", siteId: "saved", locationCode: 2840, languageCode: "en" }); expect(marketSupports(markets, input)).toBe(false); expect(marketSupports(markets, { ...input, platform: "google" })).toBe(true); });
});
