import { describe, expect, it } from "vitest";
import { resolveInstagramAppUrl } from "./urls";

describe("Instagram OAuth app URL", () => {
  it("uses the production domain instead of a localhost build setting", () => {
    expect(resolveInstagramAppUrl("http://localhost:3003", true)).toBe("https://aifekr.com");
  });

  it("normalizes a configured production URL", () => {
    expect(resolveInstagramAppUrl("https://aifekr.com/", true)).toBe("https://aifekr.com");
  });

  it("keeps a configured development URL", () => {
    expect(resolveInstagramAppUrl("http://localhost:3003/", false)).toBe("http://localhost:3003");
  });

  it("falls back safely for a malformed URL", () => {
    expect(resolveInstagramAppUrl("not a URL", true)).toBe("https://aifekr.com");
  });
});
