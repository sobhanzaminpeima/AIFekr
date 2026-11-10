import { describe, expect, it } from "vitest";
import { addCalendarMonths, renewedExpiry, termEnd } from "./term";

const d = (s: string) => new Date(s);

describe("subscription term", () => {
  it("one month is one calendar month, month-end clamped", () => {
    expect(addCalendarMonths(d("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addCalendarMonths(d("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addCalendarMonths(d("2026-03-15T00:00:00Z"), 1).toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });
  it("three months is three calendar months, across the year end", () => {
    expect(termEnd(d("2026-11-30T12:00:00Z"), 90, 3).toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(termEnd(d("2026-11-06T12:00:00Z"), 90, 3).toISOString()).toBe("2027-02-06T12:00:00.000Z");
  });
  it("custom day counts and credit packs keep their days", () => {
    expect(termEnd(d("2026-11-06T00:00:00Z"), 7, 1).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(termEnd(d("2026-11-06T00:00:00Z"), 30, null).toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });
  it("a renewal stacks on a current expiry still in the future, else starts now", () => {
    const now = d("2026-11-06T00:00:00Z");
    expect(renewedExpiry(d("2026-12-10T00:00:00Z"), 30, 1, now).toISOString()).toBe("2027-01-10T00:00:00.000Z");
    expect(renewedExpiry(d("2026-10-01T00:00:00Z"), 30, 1, now).toISOString()).toBe("2026-12-06T00:00:00.000Z");
    expect(renewedExpiry(null, 90, 3, now).toISOString()).toBe("2027-02-06T00:00:00.000Z");
  });
});
