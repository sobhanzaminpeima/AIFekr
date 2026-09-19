import { describe, it, expect } from "vitest";
import { formatSources } from "./formatSources";

describe("formatSources", () => {
  it("disambiguates sources that share an identical heading across different documents", () => {
    const result = formatSources(
      [
        { title: "Accounting", heading: "Where to find it" },
        { title: "CRM", heading: "Where to find it" },
      ],
      "en"
    );
    expect(result).toBe("Accounting — Where to find it, CRM — Where to find it");
  });

  it("doesn't repeat the title for a document's leading chunk, where heading already equals the title", () => {
    expect(formatSources([{ title: "Accounting", heading: "Accounting" }], "en")).toBe("Accounting");
  });

  it("deduplicates identical labels", () => {
    const result = formatSources(
      [
        { title: "Accounting", heading: "Where to find it" },
        { title: "Accounting", heading: "Where to find it" },
      ],
      "en"
    );
    expect(result).toBe("Accounting — Where to find it");
  });

  it("uses a Persian comma for fa and a plain comma for en/de, never mixing the two", () => {
    const sources = [
      { title: "CRM", heading: "Where to find it" },
      { title: "Accounting", heading: "Where to find it" },
    ];
    expect(formatSources(sources, "fa")).toContain("، ");
    expect(formatSources(sources, "en")).not.toContain("، ");
    expect(formatSources(sources, "de")).not.toContain("، ");
  });

  it("returns an empty string for no sources, rather than throwing", () => {
    expect(formatSources([], "en")).toBe("");
  });
});
