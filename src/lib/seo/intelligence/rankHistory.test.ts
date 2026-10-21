import { describe, it, expect } from "vitest";
import { rankObservation, csvCell } from "./rankHistory";
import { seoRequestSchema } from "./provider";
const job = { id: "sample", createdAt: new Date("2026-10-08T00:00:00Z"), completedAt: null, input: JSON.stringify({ action: "rank", siteId: "site", keyword: "react course", locationCode: 2840, languageCode: "en" }), result: JSON.stringify([{ type: "organic", domain: "www.example.com", rank_absolute: 4 }, { type: "organic", domain: "docs.example.com", rank_absolute: 2 }]) };
describe("authoritative saved rank observations", () => {
  it("uses the best observed organic position for the saved domain", () => { expect(rankObservation(job, "example.com")?.position).toBe(2); });
  it("never matches an unrelated suffix or paid result", () => { expect(rankObservation({ ...job, result: JSON.stringify([{ type: "organic", domain: "evil-example.com", rank_absolute: 1 }, { type: "paid", domain: "example.com", rank_absolute: 1 }]) }, "example.com")?.position).toBeNull(); });
  it("absence in the first ten results is unknown, never position zero", () => { expect(rankObservation({ ...job, result: "[]" }, "example.com")?.position).toBeNull(); });
  it("preserves country, language and device instead of combining markets", () => { expect(rankObservation(job, "example.com")).toMatchObject({ locationCode: 2840, languageCode: "en", device: "desktop", depth: 10 }); });
  it("ignores corrupted historical data", () => { expect(rankObservation({ ...job, input: "broken" }, "example.com")).toBeNull(); });
  it("escapes formulas and quotes in CSV exports", () => { expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"'); expect(csvCell(null)).toBe('""'); });
  it("blocks SERP pricing multipliers before a fixed-price reservation", () => { expect(() => seoRequestSchema.parse({ action: "rank", siteId: "site", keyword: "site:example.com", locationCode: 2840, languageCode: "en" })).toThrow("PRICE_MULTIPLYING_SEARCH_OPERATOR"); });
});
