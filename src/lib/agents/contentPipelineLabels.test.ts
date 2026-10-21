import { describe, it, expect } from "vitest";
import { LABEL, readLabel, readPipelineField } from "./contentPipelineLabels";

// Six fields in the pipeline route were parsed out of Persian phrases the
// prompt itself had written ("عنوان سئو:", "اسلاگ:", ...). Once the pipeline
// answers in three languages those regexes match nothing, and the failure is
// silent: the article still publishes, just with no SEO title, no meta
// description, and a slug of "post-<runId>".

describe("readPipelineField", () => {
  const EN = `SEO_TITLE: Choosing a rental in North Cyprus
META_DESCRIPTION: What to check before you sign.
SLUG: choosing-a-rental-north-cyprus
KEYWORDS: north cyprus, rental, long stay`;

  const DE = `SEO_TITLE: Mietwohnung in Nordzypern finden
META_DESCRIPTION: Worauf Sie vor der Unterschrift achten sollten.
SLUG: mietwohnung-nordzypern
KEYWORDS: nordzypern, miete, langzeit`;

  it("reads every field in English", () => {
    expect(readPipelineField(EN, "seoTitle")).toBe("Choosing a rental in North Cyprus");
    expect(readPipelineField(EN, "metaDescription")).toBe("What to check before you sign.");
    expect(readPipelineField(EN, "slug")).toBe("choosing-a-rental-north-cyprus");
    expect(readPipelineField(EN, "keywords")).toBe("north cyprus, rental, long stay");
  });

  it("reads every field in German", () => {
    expect(readPipelineField(DE, "seoTitle")).toBe("Mietwohnung in Nordzypern finden");
    expect(readPipelineField(DE, "slug")).toBe("mietwohnung-nordzypern");
  });

  it("still reads the Persian labels these replaced", () => {
    const legacy = `عنوان سئو: اجاره ملک در قبرس شمالی\nاسلاگ: rent-north-cyprus`;
    expect(readPipelineField(legacy, "seoTitle")).toBe("اجاره ملک در قبرس شمالی");
    expect(readPipelineField(legacy, "slug")).toBe("rent-north-cyprus");
  });

  it("tolerates the model bolding a label", () => {
    expect(readPipelineField("**SLUG**: my-post", "slug")).toBe("my-post");
  });

  it("returns undefined rather than an empty string when a field is missing", () => {
    expect(readPipelineField(EN, "finalTitle")).toBeUndefined();
    expect(readPipelineField("", "slug")).toBeUndefined();
    expect(readPipelineField("SLUG:", "slug")).toBeUndefined();
  });

  it("does not match a label mentioned mid-sentence", () => {
    // Guards against picking up the model explaining itself rather than
    // answering — the value must start its own line.
    expect(readLabel("I will now write the SLUG: value below", LABEL.slug)).toBeUndefined();
  });

  it("takes the first occurrence when the model repeats itself", () => {
    expect(readPipelineField("SLUG: first-one\nSLUG: second-one", "slug")).toBe("first-one");
  });
});
