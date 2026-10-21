import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, isEncrypted } from "./secretBox";

beforeAll(() => { process.env.JWT_SECRET ||= "test-secret"; });

describe("secretBox", () => {
  it("round-trips a secret and never stores it in the clear", () => {
    const stored = encryptSecret("1//0gRefreshTokenValue");
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain("RefreshToken");
    expect(decryptSecret(stored)).toBe("1//0gRefreshTokenValue");
  });

  it("uses a fresh IV each time, so equal secrets do not look equal", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("returns legacy plaintext rows unchanged (no flag-day migration)", () => {
    expect(decryptSecret("abcd efgh 1234")).toBe("abcd efgh 1234");
  });

  it("does not double-encrypt", () => {
    const once = encryptSecret("x");
    expect(encryptSecret(once)).toBe(once);
  });

  it("rejects a tampered value instead of returning garbage", () => {
    const stored = encryptSecret("secret");
    const parts = stored.split(":");
    parts[4] = parts[4].slice(0, -2) + (parts[4].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("cannot be read with a different key", () => {
    const stored = encryptSecret("secret");
    const prev = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "another-key";
    try {
      expect(() => decryptSecret(stored)).toThrow();
    } finally {
      if (prev === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = prev;
    }
  });
});
