import { describe, expect, it } from "vitest";
import { draftFromGeneration } from "./toWordpress";

describe("SEO result to WordPress draft", () => {
  it("takes the title from the first heading and the SEO fields from the text", () => {
    const d = draftFromGeneration({ tool: "content", keyword: "خرید قهوه", output: "## راهنمای خرید قهوهٔ تازه\n\nقهوهٔ تازه‌برشته طعم بهتری دارد و بهتر است دانه را چند روز پس از برشته شدن آسیاب کنید.\n\n- نکته" });
    expect(d).toMatchObject({ title: "راهنمای خرید قهوهٔ تازه", slug: "راهنمای-خرید-قهوهٔ-تازه", seo: { focusKeyword: "خرید قهوه" } });
    expect(d!.excerpt.startsWith("قهوهٔ تازه‌برشته")).toBe(true);
    expect(d!.seo.title.length).toBeLessThanOrEqual(60);
  });
  it("falls back to the keyword when there is no heading", () => {
    expect(draftFromGeneration({ tool: "meta", keyword: "buy coffee", output: "Title options and descriptions" })!.title).toBe("buy coffee");
  });
  it("does not turn keyword lists or plans into posts", () => {
    expect(draftFromGeneration({ tool: "keyword", keyword: "x", output: "| a | b |" })).toBeNull();
    expect(draftFromGeneration({ tool: "improve", keyword: null, output: "{}" })).toBeNull();
  });
});
