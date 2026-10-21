import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, csvToObjects } from "./csv";

describe("csv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields with commas and embedded newlines", () => {
    const text = 'title,note\n"Hello, world","Line1\nLine2"';
    expect(parseCsv(text)).toEqual([["title", "note"], ["Hello, world", "Line1\nLine2"]]);
  });

  it("handles escaped quotes (\"\")", () => {
    expect(parseCsv('a\n"She said ""hi"""')).toEqual([["a"], ['She said "hi"']]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["a", "b,c"], ['with "quotes"', "plain"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("converts rows to objects keyed by header", () => {
    const objs = csvToObjects("name,price\nAlice,100\nBob,200");
    expect(objs).toEqual([{ name: "Alice", price: "100" }, { name: "Bob", price: "200" }]);
  });

  it("returns empty array for empty input", () => {
    expect(csvToObjects("")).toEqual([]);
  });
});
