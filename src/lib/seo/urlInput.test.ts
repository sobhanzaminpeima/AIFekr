import { describe, it, expect } from "vitest";
import { normalizeUrlInput } from "./urlInput";

describe("normalizeUrlInput", () => {
  it.each([
    ["mysite.com", "https://mysite.com/"],
    ["www.mysite.com/blog", "https://www.mysite.com/blog"],
    ["  https://mysite.com/page?x=1  ", "https://mysite.com/page?x=1"],
    ["http://mysite.com", "http://mysite.com/"],
    ["//mysite.com/a", "https://mysite.com/a"],
  ])("accepts %s", (input, expected) => expect(normalizeUrlInput(input)).toBe(expected));

  it.each(["", "   ", "my site", "localhost", "abc", "ftp://mysite.com", "javascript:alert(1)", "file:///etc/passwd"])(
    "rejects %j", (input) => expect(normalizeUrlInput(input)).toBeNull());
});
