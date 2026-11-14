import { describe, expect, it } from "vitest";
import { eventVerdict, fallbackVerdict, rateVerdicts } from "./observability";

const now = new Date("2026-11-12T12:00:00Z").getTime();

describe("owner observability verdicts", () => {
  it("rates provider fallbacks against chat traffic", () => {
    expect(fallbackVerdict(0, 100)).toBe("ok");
    expect(fallbackVerdict(20, 100)).toBe("attention");
    expect(fallbackVerdict(62, 100)).toBe("broken");
  });
  it("says inbound events are broken when nothing arrived for a week (production: last event 2026-10-05)", () => {
    expect(eventVerdict(new Date("2026-10-05T10:00:00Z"), 0, now)).toBe("broken");
    expect(eventVerdict(new Date("2026-11-12T11:00:00Z"), 2, now)).toBe("attention");
    expect(eventVerdict(null, 0, now)).toBe("attention");
  });
  it("flags a missing or expired approved rate", () => {
    const rows = [{ target: "IRT", validUntil: new Date("2026-11-01T00:00:00Z") }, { target: "TRY", validUntil: new Date("2026-11-20T00:00:00Z") }];
    expect(rateVerdicts(rows, ["IRT", "TRY", "EUR"], now).map((r) => r.verdict)).toEqual(["broken", "ok", "broken"]);
  });
});
