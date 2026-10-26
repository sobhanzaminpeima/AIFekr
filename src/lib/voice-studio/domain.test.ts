import { describe, it, expect } from "vitest";
import { graphemes, creditsFor, estimatedSeconds, splitProject, projectText, defaults, settingsSchema } from "./domain";
describe("Voice Studio text and credits", () => {
    it("counts graphemes independently from provider input units", () => { expect(graphemes("👨‍👩‍👧‍👦e\u0301")).toBe(2); expect("👨‍👩‍👧‍👦".length).toBeGreaterThan(1); });
    it.each([[.1, 45], [30, 45], [30.001, 90], [60, 90]])("bills %s seconds as %s", (seconds, cost) => expect(creditsFor(seconds, defaults)).toBe(cost));
    it("supports the separately versioned 20-second tariff", () => expect(creditsFor(60, { creditsPerInterval: 45, billingInterval: 20 })).toBe(135));
    it("rejects invalid durations instead of inventing zero charges", () => { for (const n of [0, -1, NaN, Infinity])
        expect(() => creditsFor(n, defaults)).toThrow(); });
    it("preserves all 20,000 characters across independent short segments", () => { const text = "سلام دوست من. ".repeat(1400).slice(0, 20000); expect(() => projectText(text, 20000)).not.toThrow(); const chunks = splitProject(text, "fa", 60, 5000); expect(chunks.length).toBeGreaterThan(1); expect(chunks.join("")).toBe(text); for (const chunk of chunks)
        expect(estimatedSeconds(chunk, "fa")).toBeLessThanOrEqual(39); });
    it("rejects overflow without truncating user text", () => expect(() => projectText("a".repeat(20001), 20000)).toThrow("PROJECT_TEXT_TOO_LONG"));
    it("rejects an indivisible overlong token before a provider request", () => expect(() => splitProject("a".repeat(10000), "en", 60, 100)).toThrow("UNSPLITTABLE_TEXT"));
    it("keeps limits independent and module disabled until rollout", () => { expect(defaults.maxCharacters).toBe(20000); expect(defaults.maxDurationSeconds).toBe(60); expect(defaults.enabled).toBe(false); expect(settingsSchema.safeParse({ ...defaults, maxDurationSeconds: 61 }).success).toBe(false); });
});
