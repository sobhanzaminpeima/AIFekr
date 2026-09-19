import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseKbDocument, KB_LANGS } from "./parse";
import { docSlugs } from "../registry";

const SAMPLE = `---
slug: crm
capability: crm
---

<!--lang:fa-->
# مدیریت مشتریان
### چیست؟
توضیح فارسی.
### کجاست؟
سایدبار.

<!--lang:en-->
# CRM
### What it is
An explanation.
### Where to find it
The sidebar.

<!--lang:de-->
# CRM
### Was es ist
Eine Erklärung.
### Wo Sie es finden
Die Seitenleiste.
`;

describe("parseKbDocument", () => {
  it("reads frontmatter and splits all three language blocks", () => {
    const doc = parseKbDocument("crm", SAMPLE);
    expect(doc.slug).toBe("crm");
    expect(doc.capabilityKey).toBe("crm");
    expect(doc.blocks.map((b) => b.lang)).toEqual(["fa", "en", "de"]);
    expect(doc.missingLangs).toEqual([]);
  });

  it("takes each block's title from its own `# ` line", () => {
    const doc = parseKbDocument("crm", SAMPLE);
    expect(doc.blocks.find((b) => b.lang === "fa")!.title).toBe("مدیریت مشتریان");
    expect(doc.blocks.find((b) => b.lang === "de")!.title).toBe("CRM");
  });

  it("makes one chunk per ### heading, carrying the heading into the text", () => {
    const en = parseKbDocument("crm", SAMPLE).blocks.find((b) => b.lang === "en")!;
    expect(en.chunks).toHaveLength(2);
    expect(en.chunks[0].heading).toBe("What it is");
    expect(en.chunks[0].ordinal).toBe(0);
    // The heading is part of the embedded text so a chunk carries its own topic
    // even when retrieved without its neighbours.
    expect(en.chunks[0].text).toContain("What it is");
    expect(en.chunks[0].text).toContain("An explanation.");
    expect(en.chunks[1].heading).toBe("Where to find it");
  });

  it("prefixes the document title so identically-headed sections don't collide", () => {
    // Every capability doc has a "where to find it" section; without the title
    // in the text they embed to near-identical vectors and retrieval picks the
    // wrong document. The citation label stays the bare heading.
    const fa = parseKbDocument("crm", SAMPLE).blocks.find((b) => b.lang === "fa")!;
    const where = fa.chunks.find((c) => c.heading === "کجاست؟")!;
    expect(where.text.startsWith("مدیریت مشتریان — کجاست؟")).toBe(true);
    expect(where.heading).toBe("کجاست؟");
  });

  it("does not repeat the title when the section IS the title (the intro chunk)", () => {
    const doc = parseKbDocument("x", `<!--lang:en-->\n# Title\nLeading paragraph.\n### A section\nBody.`);
    expect(doc.blocks[0].chunks[0].text).toBe("Title\nLeading paragraph.");
  });

  it("keeps intro text that appears before the first ### heading", () => {
    const doc = parseKbDocument("x", `<!--lang:en-->\n# Title\nLeading paragraph.\n### A section\nBody.`);
    const chunks = doc.blocks[0].chunks;
    expect(chunks[0].heading).toBe("Title");
    expect(chunks[0].text).toContain("Leading paragraph.");
    expect(chunks[1].heading).toBe("A section");
  });

  it("reports a missing language rather than silently dropping it", () => {
    const doc = parseKbDocument("x", `<!--lang:en-->\n# Title\n### S\nBody.\n\n<!--lang:fa-->\n# عنوان\n### بخش\nمتن.`);
    expect(doc.missingLangs).toEqual(["de"]);
  });

  it("survives a file with no frontmatter, falling back to the filename slug", () => {
    const doc = parseKbDocument("navigation", `<!--lang:en-->\n# Title\n### S\nBody.`);
    expect(doc.slug).toBe("navigation");
    expect(doc.capabilityKey).toBeNull();
  });

  it("produces no blocks for a file with no language markers, instead of one malformed one", () => {
    expect(parseKbDocument("x", "# Just a heading\nSome text.").blocks).toEqual([]);
  });
});

// Guards the content itself, not just the parser: a doc-set that silently lost
// its German half would still pass every test above.
describe("the shipped knowledge base", () => {
  const dir = path.join(process.cwd(), "docs", "knowledge-base");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");

  it("has a file for every slug the registry references", () => {
    const present = new Set(files.map((f) => f.replace(/\.md$/, "")));
    expect(docSlugs().filter((s) => !present.has(s))).toEqual([]);
  });

  it.each(files)("%s parses, declares all three languages, and has chunks in each", (file) => {
    const doc = parseKbDocument(file.replace(/\.md$/, ""), fs.readFileSync(path.join(dir, file), "utf-8"));
    expect(doc.missingLangs).toEqual([]);
    for (const lang of KB_LANGS) {
      const block = doc.blocks.find((b) => b.lang === lang)!;
      expect(block.chunks.length).toBeGreaterThan(0);
    }
  });

  it.each(files)("%s declares a slug matching its filename", (file) => {
    const slug = file.replace(/\.md$/, "");
    expect(parseKbDocument(slug, fs.readFileSync(path.join(dir, file), "utf-8")).slug).toBe(slug);
  });
});
