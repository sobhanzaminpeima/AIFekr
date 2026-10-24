import { describe, it, expect } from "vitest";

// Ensure JWT_SECRET is set before importing the module
process.env.JWT_SECRET = "test-secret-for-oauth-state-tests";

const { encodeOAuthState, decodeOAuthState } = await import("./oauthState");

describe("oauthState — HMAC-SHA256 signed OAuth state nonce", () => {
  it("encodes and decodes a userId round-trip", () => {
    const userId = "user_abc123";
    const state = encodeOAuthState(userId);
    expect(typeof state).toBe("string");
    expect(state.length).toBeGreaterThan(20);
    const decoded = decodeOAuthState(state);
    expect(decoded).toBe(userId);
  });

  it("returns null for tampered state", () => {
    const state = encodeOAuthState("user1");
    // Flip the last character to break HMAC
    const tampered = state.slice(0, -1) + (state.slice(-1) === "a" ? "b" : "a");
    expect(decodeOAuthState(tampered)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeOAuthState("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(decodeOAuthState("not-base64url!!")).toBeNull();
    expect(decodeOAuthState("eyJub3QiOiJ2YWxpZCJ9")).toBeNull();
  });

  it("returns null for a state with incorrect number of parts", () => {
    const badState = Buffer.from("only:two").toString("base64url");
    expect(decodeOAuthState(badState)).toBeNull();
  });
});
