import { describe, it, expect } from "vitest";
import { looksLikeWrongLanguage, buildSupportSystemPrompt } from "./systemPrompt";

/**
 * Regression tests for the 2026-09-12 incident: a real user asked a question
 * in Spanish and got a fluent Spanish answer, even though Spanish isn't one
 * of this platform's three languages. `looksLikeWrongLanguage` is the runtime
 * safety net added alongside the strengthened prompt -- these tests are the
 * actual real-world text from that incident and its follow-ups, not
 * synthetic examples.
 */
describe("looksLikeWrongLanguage", () => {
  const spanishAnswer =
    "Las facturas se encuentran dentro de la sección **Accounting**.\nEn el menú lateral, ve a **My Business → Finance & accounting → Accounting**.";

  it("flags the real Spanish answer from the incident when English was expected", () => {
    expect(looksLikeWrongLanguage(spanishAnswer, "en")).toBe(true);
  });

  it("flags the same Spanish answer when Persian or German was expected", () => {
    expect(looksLikeWrongLanguage(spanishAnswer, "fa")).toBe(true);
    expect(looksLikeWrongLanguage(spanishAnswer, "de")).toBe(true);
  });

  it("does not flag a genuine, correctly-answered English response", () => {
    const en = "You can find invoices in the **Accounting** section: Sidebar → My Business → Finance & accounting → Accounting → Invoices.";
    expect(looksLikeWrongLanguage(en, "en")).toBe(false);
  });

  it("does not flag a genuine, correctly-answered German response", () => {
    const de = "Rechnungen finden Sie im Bereich **Buchhaltung**: Seitenleiste → Mein Unternehmen → Finanzen & Buchhaltung → Buchhaltung.";
    expect(looksLikeWrongLanguage(de, "de")).toBe(false);
  });

  it("does not flag a genuine, correctly-answered Persian response", () => {
    const fa = "فاکتورها را می‌توانید در بخش **حسابداری** پیدا کنید: سایدبار ← کسب‌وکار من ← مالی و حسابداری ← حسابداری.";
    expect(looksLikeWrongLanguage(fa, "fa")).toBe(false);
  });

  it("flags Persian script when English or German was expected", () => {
    const fa = "فاکتورها را می‌توانید در بخش حسابداری پیدا کنید.";
    expect(looksLikeWrongLanguage(fa, "en")).toBe(true);
    expect(looksLikeWrongLanguage(fa, "de")).toBe(true);
  });

  it("does not flag an empty or whitespace-only response as wrong-language (nothing to judge yet)", () => {
    expect(looksLikeWrongLanguage("", "en")).toBe(false);
    expect(looksLikeWrongLanguage("   ", "fa")).toBe(false);
  });

  it("does not flag a short English answer as wrong German -- avoids false positives on brief replies", () => {
    // A very short reply (e.g. a bare link or a single word) shouldn't trip
    // the German heuristic, which only judges text long enough to expect a
    // German function word in.
    expect(looksLikeWrongLanguage("OK", "de")).toBe(false);
  });
});

describe("buildSupportSystemPrompt language enforcement", () => {
  it("states the concrete language name, not just 'the current UI language', for every variant", () => {
    // The bug was traced to phrasing that referred to the language
    // indirectly; this locks in that each prompt now names the language
    // outright, in both the opening and closing lines.
    expect(buildSupportSystemPrompt("fa")).toContain("فقط و فقط به زبان فارسی");
    expect(buildSupportSystemPrompt("en")).toMatch(/entire answer in English only/i);
    expect(buildSupportSystemPrompt("de")).toMatch(/ausschließlich auf Deutsch/i);
  });

  it("repeats the language rule as the closing line, not only the opening one", () => {
    const en = buildSupportSystemPrompt("en");
    const lines = en.trim().split("\n");
    expect(lines[lines.length - 1]).toMatch(/English only/i);
  });
});
