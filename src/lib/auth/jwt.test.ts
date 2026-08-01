import { describe, it, expect, beforeEach, vi } from "vitest";

const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe("jwt", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = ORIGINAL_SECRET ?? "test-secret";
  });

  it("throws at import time if JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    await expect(import("./jwt")).rejects.toThrow(/JWT_SECRET/);
  });

  it("signs and verifies a token round-trip", async () => {
    process.env.JWT_SECRET = "a-real-test-secret";
    const { signToken, verifyToken } = await import("./jwt");
    const payload = { userId: "u1", role: "USER", plan: "FREE" };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it("returns null for a token signed with a different secret", async () => {
    process.env.JWT_SECRET = "secret-a";
    const { signToken } = await import("./jwt");
    const token = signToken({ userId: "u1", role: "USER", plan: "FREE" });

    vi.resetModules();
    process.env.JWT_SECRET = "secret-b";
    const { verifyToken } = await import("./jwt");
    expect(verifyToken(token)).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    process.env.JWT_SECRET = "a-real-test-secret";
    const { verifyToken } = await import("./jwt");
    expect(verifyToken("not-a-real-token")).toBeNull();
  });
});
