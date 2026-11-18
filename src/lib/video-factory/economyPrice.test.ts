import { describe, expect, it } from "vitest";
import { economyPrice } from "./economyPrice";

describe("economy video price", () => {
  it("uses the current price of one equivalent standard video", () => {
    expect(economyPrice(1000)).toBe(800);
    expect(economyPrice(1500)).toBe(1200);
    expect(economyPrice(1500, 10)).toBe(1350);
  });
  it("stays positive and cheaper after rounding", () => {
    expect(economyPrice(2, 99)).toBe(1);
    expect(economyPrice(9, 1)).toBe(8);
  });
  it("rejects missing or invalid prices and discounts", () => {
    for (const price of [NaN, 0, 1, -1, 1.5]) expect(() => economyPrice(price)).toThrow();
    for (const discount of [NaN, 0, 100, -1, 1.5]) expect(() => economyPrice(100, discount)).toThrow();
  });
});
