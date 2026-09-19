import { describe, it, expect } from "vitest";
import { findOpportunities, type GscQueryRow } from "./opportunities";

const row = (over: Partial<GscQueryRow>): GscQueryRow => ({ query: "q", clicks: 0, impressions: 1000, ctr: 1, position: 8, ...over });

describe("findOpportunities", () => {
  it("flags a page-1/2 query outside the top 3 with real impressions", () => {
    const [o] = findOpportunities([row({ query: "buy flat berlin", position: 9, impressions: 800, ctr: 1 })]);
    expect(o.kind).toBe("striking_distance");
    expect(o.potentialExtraClicks).toBe(72); // 800 * (10% - 1%)
  });

  it("flags a top-5 query whose CTR is far below the norm for that position", () => {
    const [o] = findOpportunities([row({ query: "brand", position: 2, impressions: 1000, ctr: 3 })]);
    expect(o.kind).toBe("low_ctr");
    expect(o.potentialExtraClicks).toBe(120); // 1000 * (15% - 3%)
  });

  it("ignores queries without enough data behind them", () => {
    expect(findOpportunities([row({ impressions: 10, position: 9 }), row({ impressions: 40, position: 2, ctr: 0.5 })])).toEqual([]);
  });

  it("does not flag a query that already performs as expected", () => {
    expect(findOpportunities([row({ position: 1, impressions: 5000, ctr: 27 })])).toEqual([]);
  });

  it("ignores positions past page 2", () => {
    expect(findOpportunities([row({ position: 35, impressions: 9000 })])).toEqual([]);
  });

  it("ranks by potential and respects the limit", () => {
    const rows = [row({ query: "a", position: 6, impressions: 100, ctr: 2 }), row({ query: "b", position: 6, impressions: 900, ctr: 2 }), row({ query: "c", position: 6, impressions: 300, ctr: 2 })];
    expect(findOpportunities(rows, 2).map((o) => o.query)).toEqual(["b", "c"]);
  });
});
