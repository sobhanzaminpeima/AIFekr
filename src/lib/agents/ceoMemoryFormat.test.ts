import { describe, it, expect } from "vitest";
import { MEMORY_MARKER, extractMemoryLines, stripMemorySection } from "./ceoMemoryFormat";

// The old parser matched the Persian Markdown heading "## نکاتی برای حافظهٔ آینده".
// Once the orchestrator became trilingual that heading was translated, so the
// regex matched nothing and the CEO silently stopped learning — no error, no
// log line, just an agent that never remembers anything again. These tests
// exist to make that failure loud instead.

const EN_OUTPUT = `## Situation summary
Revenue is up but follow-ups are slipping.

## Suggested decisions
- Chase the three stale deals.

${MEMORY_MARKER}
[sales] Deals older than 21 days almost never close.
[content] Comparison posts converted best this quarter.
`;

const DE_OUTPUT = `## Lagebericht
Der Umsatz steigt.

${MEMORY_MARKER}
[seo] Long-Tail-Keywords bringen mehr Conversions.
`;

describe("extractMemoryLines", () => {
  it("finds memories regardless of the output language", () => {
    expect(extractMemoryLines(EN_OUTPUT)).toEqual([
      { category: "sales", text: "Deals older than 21 days almost never close." },
      { category: "content", text: "Comparison posts converted best this quarter." },
    ]);
    expect(extractMemoryLines(DE_OUTPUT)).toEqual([
      { category: "seo", text: "Long-Tail-Keywords bringen mehr Conversions." },
    ]);
  });

  it("returns nothing rather than throwing when the model omits the section", () => {
    expect(extractMemoryLines("## Situation summary\nAll quiet.")).toEqual([]);
    expect(extractMemoryLines("")).toEqual([]);
  });

  it("ignores lines with an unknown category instead of storing junk", () => {
    const out = `${MEMORY_MARKER}\n[marketing] not a real category\n[dev] Groq failed twice this week.`;
    expect(extractMemoryLines(out)).toEqual([{ category: "dev", text: "Groq failed twice this week." }]);
  });

  it("never treats prose before the marker as a memory", () => {
    const out = `The CEO noted [sales] figures were strong.\n${MEMORY_MARKER}\n[general] Keep watching cash flow.`;
    expect(extractMemoryLines(out)).toEqual([{ category: "general", text: "Keep watching cash flow." }]);
  });
});

describe("stripMemorySection", () => {
  it("removes the marker and everything after it", () => {
    const shown = stripMemorySection(EN_OUTPUT);
    expect(shown).not.toContain(MEMORY_MARKER);
    expect(shown).not.toContain("[sales]");
    expect(shown).toContain("Chase the three stale deals.");
  });

  it("leaves output without a marker untouched apart from trailing space", () => {
    expect(stripMemorySection("## Summary\nAll good.\n")).toBe("## Summary\nAll good.");
  });
});
