import { describe, it, expect } from "vitest";
import { generateTempPassword } from "./invitePassword";

describe("generateTempPassword", () => {
  it("matches the AI{FirstName}!{Year} format", () => {
    expect(generateTempPassword("Sobhan", new Date(2026, 0, 1))).toBe("AISobhan!2026");
  });

  it("uses only the first name and capitalizes it", () => {
    expect(generateTempPassword("ali reza", new Date(2026, 0, 1))).toBe("AIAli!2026");
  });

  it("strips punctuation/spaces from the name", () => {
    expect(generateTempPassword("  o'brien  ", new Date(2026, 0, 1))).toBe("AIObrien!2026");
  });

  it("falls back to 'User' for an empty name", () => {
    expect(generateTempPassword("", new Date(2026, 0, 1))).toBe("AIUser!2026");
  });
});
