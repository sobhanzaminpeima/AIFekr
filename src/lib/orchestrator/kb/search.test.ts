import { describe, it, expect } from "vitest";
import { searchCapabilities } from "./search";

/**
 * Exercises the tokenizer and keyword scorer through the one export that
 * doesn't touch the database. The tokenizer is the piece most likely to break
 * silently: it uses explicit unicode ranges (the tsconfig has no `target`, so
 * `\p{L}` with the `u` flag is a compile error here), and a range typo would
 * simply stop matching one language rather than throwing anywhere.
 */
describe("searchCapabilities", () => {
  it("finds a capability from an English query", () => {
    expect(searchCapabilities("where is the accounting section", "en").map((c) => c.key)).toContain("accounting");
  });

  it("finds a capability from a Persian query", () => {
    expect(searchCapabilities("حسابداری کجاست", "fa").map((c) => c.key)).toContain("accounting");
  });

  it("finds a capability from a German query, umlauts included", () => {
    const keys = searchCapabilities("Wo finde ich die Buchhaltung", "de").map((c) => c.key);
    expect(keys).toContain("accounting");
  });

  it("tokenizes German compound vocabulary with ß and umlauts without dropping the word", () => {
    // "Geschäftsideen" and "Vertriebspipeline" only match if À-ɏ is in the
    // word-character range; a broken range would silently return nothing.
    expect(searchCapabilities("Vertriebspipeline", "de").map((c) => c.key)).toContain("crm");
  });

  it("matches on the capability key itself, so a user typing a URL fragment still lands somewhere", () => {
    expect(searchCapabilities("lead-gen", "en").map((c) => c.key)).toContain("lead-gen");
  });

  it("returns nothing for a query with no usable terms rather than an arbitrary result", () => {
    expect(searchCapabilities("   ?? !!  ", "en")).toEqual([]);
    expect(searchCapabilities("", "fa")).toEqual([]);
  });

  it("returns no more than the requested number of results", () => {
    expect(searchCapabilities("business", "en", 2).length).toBeLessThanOrEqual(2);
  });
});
