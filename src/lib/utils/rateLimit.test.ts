import { describe, it, expect, vi, beforeEach } from "vitest";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  it("allows requests up to the limit, then blocks", async () => {
    const { rateLimit } = await import("./rateLimit");
    const key = "test-key-1";
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, 3, 60_000);
      expect(result.allowed).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets the window after it expires", async () => {
    const { rateLimit } = await import("./rateLimit");
    const key = "test-key-2";
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const { rateLimit } = await import("./rateLimit");
    rateLimit("key-a", 1, 60_000);
    const resultB = rateLimit("key-b", 1, 60_000);
    expect(resultB.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry in x-forwarded-for", async () => {
    const { getClientIp } = await import("./rateLimit");
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", async () => {
    const { getClientIp } = await import("./rateLimit");
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when no IP headers are present", async () => {
    const { getClientIp } = await import("./rateLimit");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
