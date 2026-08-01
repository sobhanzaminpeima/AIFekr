import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "crypto";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-legacy-hash-only";
});

describe("password hashing", () => {
  it("hashes with bcrypt and verifies correctly", async () => {
    const { hashPassword, verifyPassword } = await import("./password");
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).toMatch(/^\$2[aby]\$/);

    const result = await verifyPassword("correct-horse-battery-staple", hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it("rejects a wrong password against a bcrypt hash", async () => {
    const { hashPassword, verifyPassword } = await import("./password");
    const hash = await hashPassword("right-password");
    const result = await verifyPassword("wrong-password", hash);
    expect(result.valid).toBe(false);
  });

  it("accepts a legacy SHA-256 hash and flags it for rehash", async () => {
    const { verifyPassword } = await import("./password");
    const legacyHash = createHash("sha256").update("old-password" + process.env.JWT_SECRET).digest("hex");

    const result = await verifyPassword("old-password", legacyHash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it("rejects a wrong password against a legacy SHA-256 hash without flagging rehash", async () => {
    const { verifyPassword } = await import("./password");
    const legacyHash = createHash("sha256").update("old-password" + process.env.JWT_SECRET).digest("hex");

    const result = await verifyPassword("wrong-guess", legacyHash);
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const { hashPassword } = await import("./password");
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});
