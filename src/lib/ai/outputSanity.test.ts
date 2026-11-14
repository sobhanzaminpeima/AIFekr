import { describe, expect, it } from "vitest";
import { wrongLanguage } from "./outputSanity";

const fa = "هوش مصنوعی شاخه‌ای از علوم رایانه است که به ساخت سامانه‌هایی می‌پردازد که می‌توانند یاد بگیرند و تصمیم بگیرند.";
const en = "Artificial intelligence is a branch of computer science that builds systems able to learn and make decisions.";

describe("answer language guard", () => {
  it("accepts an answer in the language asked for", () => {
    expect(wrongLanguage("fa", fa)).toBe(false);
    expect(wrongLanguage("en", en)).toBe(false);
  });
  it("catches a whole answer in the wrong language", () => {
    expect(wrongLanguage("fa", en)).toBe(true);
    expect(wrongLanguage("de", fa)).toBe(true);
  });
  it("allows Latin names and code inside a Persian answer, and ignores very short answers", () => {
    expect(wrongLanguage("fa", fa + " مثلاً Python و ChatGPT و API.")).toBe(false);
    expect(wrongLanguage("fa", "OK")).toBe(false);
  });
});
