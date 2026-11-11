import { describe, expect, it } from "vitest";
import { fallbackReason } from "./fallbackReason";

describe("provider fallback reason", () => {
  it("keeps the upstream status and message", () => {
    expect(fallbackReason(new Error("Gemini 400: completion returned empty"))).toBe("Gemini 400: completion returned empty");
  });
  it("never stores a credential the provider echoed back", () => {
    const text = fallbackReason(new Error("POST https://generativelanguage.googleapis.com/v1/models:x?key=AIzaSyA1234567890abcdef failed; Authorization: Bearer abc.def-ghi; sk-proj-1234567890abcdef"));
    expect(text).not.toMatch(/AIzaSyA1234567890abcdef|abc\.def-ghi|sk-proj-1234567890abcdef/);
    expect(text).toContain("key=[redacted]");
  });
  it("caps the length and handles non-errors", () => {
    expect(fallbackReason(new Error("x".repeat(900)))).toHaveLength(500);
    expect(fallbackReason(undefined)).toBe("unknown error");
  });
});
