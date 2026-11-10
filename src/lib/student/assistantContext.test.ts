import { describe, expect, it } from "vitest";
import { answeredMaterialsInstead, studyRequestMessage } from "./assistantContext";

const material = "Marketing brief for a property in North Cyprus: Meta ads, Google ads, SEO and a 90 day plan.";

describe("student assistant context", () => {
  it("makes the request the task and the materials optional background", () => {
    const text = studyRequestMessage("Explain.", "<materials>", "هوش مصنوعی چیست؟");
    expect(text).toMatch(/ignore it completely/);
    expect(text.trim().endsWith("هوش مصنوعی چیست؟")).toBe(true);
    expect(text.indexOf("<materials>")).toBeLessThan(text.indexOf("هوش مصنوعی چیست؟"));
  });

  it("catches the production case: a one-line question answered with the uploaded brief", () => {
    const answer = "برای فروش ملک در شمال قبرس یک برنامه ۹۰ روزه با تبلیغات Meta و Google و SEO لازم است.";
    expect(answeredMaterialsInstead("هوش مصنوعی چیست؟ در دو جمله توضیح بده.", answer, [material])).toBe(true);
  });

  it("does not fire on an on-topic answer", () => {
    expect(answeredMaterialsInstead("هوش مصنوعی چیست؟", "هوش مصنوعی شاخه‌ای از علوم کامپیوتر است.", [material])).toBe(false);
    expect(answeredMaterialsInstead("How should I plan SEO for this brief?", "Start with SEO research, then Meta and Google ads.", [material])).toBe(false);
  });

  it("matches a word with a suffix", () => {
    expect(answeredMaterialsInstead("بازاریابی محتوا", "بازاریابی‌ها با Meta و Google و SEO انجام می‌شود", [material])).toBe(false);
  });

  it("never fires without materials or a topic word", () => {
    expect(answeredMaterialsInstead("هوش مصنوعی چیست؟", "یک متن کاملا بی‌ربط", [])).toBe(false);
    expect(answeredMaterialsInstead("توضیح بده", "Meta and Google and SEO", [material])).toBe(false);
  });

  it("a hint that only asks a guiding question is not flagged", () => {
    expect(answeredMaterialsInstead("مشتق تابع نمایی", "فکر می‌کنی نرخ تغییر چطور رفتار می‌کند؟", [material])).toBe(false);
  });
});
