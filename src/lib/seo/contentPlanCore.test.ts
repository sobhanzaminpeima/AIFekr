import { describe, it, expect } from "vitest";
import { nextRunDate, sanitizeTopics, parseTopics, chooseTopic, effectiveMode, isRunStale, isFrequency, isMode, MAX_TOPICS, MAX_TOPIC_LEN } from "./contentPlanCore";

describe("nextRunDate", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  it("schedules by frequency and defaults to weekly", () => {
    expect(nextRunDate("daily", from).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(nextRunDate("every3days", from).toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(nextRunDate("weekly", from).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(nextRunDate("biweekly", from).toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(nextRunDate("nonsense", from).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("sanitizeTopics", () => {
  it("takes one topic per line, trims, dedupes case-insensitively and drops blanks", () => {
    expect(sanitizeTopics("  Buying a flat in Berlin \n\nbuying a FLAT in berlin\nHome staging tips")).toEqual(["Buying a flat in Berlin", "Home staging tips"]);
  });
  it("accepts arrays and ignores non-strings", () => {
    expect(sanitizeTopics(["a", 5, null, { x: 1 }, "b"])).toEqual(["a", "b"]);
    expect(sanitizeTopics(undefined)).toEqual([]);
    expect(sanitizeTopics(42)).toEqual([]);
  });
  it("caps the count and the length", () => {
    expect(sanitizeTopics(Array.from({ length: 200 }, (_, i) => `t${i}`))).toHaveLength(MAX_TOPICS);
    expect(sanitizeTopics(["x".repeat(1000)])[0]).toHaveLength(MAX_TOPIC_LEN);
  });
});

describe("parseTopics", () => {
  it("survives corrupt stored JSON", () => {
    expect(parseTopics("not json")).toEqual([]);
    expect(parseTopics(null)).toEqual([]);
    expect(parseTopics('["a","b"]')).toEqual(["a", "b"]);
  });
});

describe("chooseTopic", () => {
  it("writes the queue in order, one per run", () => {
    expect(chooseTopic(["a", "b", "c"], "theme")).toEqual({ topic: "a", fromQueue: true, remaining: ["b", "c"] });
  });
  it("falls back to the theme when the queue is empty", () => {
    expect(chooseTopic([], "  Real estate in Berlin ")).toEqual({ topic: "Real estate in Berlin", fromQueue: false, remaining: [] });
  });
  it("has nothing to write when there are no topics and no theme", () => {
    expect(chooseTopic([], "   ")).toBeNull();
  });
});

describe("effectiveMode", () => {
  it("never claims to draft/publish without a connected site", () => {
    expect(effectiveMode("draft", false)).toBe("hold");
    expect(effectiveMode("publish", false)).toBe("hold");
    expect(effectiveMode("draft", true)).toBe("draft");
    expect(effectiveMode("publish", true)).toBe("publish");
    expect(effectiveMode("hold", true)).toBe("hold");
  });
});

describe("isRunStale / guards", () => {
  it("treats an old in-flight marker as dead, a fresh one as running", () => {
    const now = Date.now();
    expect(isRunStale(null, now)).toBe(false);
    expect(isRunStale(new Date(now - 5 * 60 * 1000), now)).toBe(false);
    expect(isRunStale(new Date(now - 30 * 60 * 1000), now)).toBe(true);
  });
  it("validates inputs", () => {
    expect(isFrequency("weekly")).toBe(true);
    expect(isFrequency("hourly")).toBe(false);
    expect(isMode("draft")).toBe(true);
    expect(isMode("auto")).toBe(false);
  });
});
