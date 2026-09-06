// Machine-read labels for the 8-agent content pipeline.
//
// Every one of these used to be a Persian phrase that both the prompt wrote and
// a regex read back — "امتیاز:", "عنوان سئو:", "اسلاگ:", and the critic's
// Persian agent names. That works while there is exactly one output language
// and fails silently the moment there are three: the model writes "Score: 82",
// the regex finds nothing, and the pipeline keeps running with no editor score
// (so the quality gate never fires), no SEO title, no meta description, and a
// slug of "post-<id>". No error is thrown anywhere.
//
// So the labels are pinned in English in all three languages and the prompts
// tell the model to emit them verbatim. Defined here, once, so a prompt and its
// parser cannot drift apart.

export const LABEL = {
  finalTitle: "FINAL_TITLE",
  score: "SCORE",
  seoTitle: "SEO_TITLE",
  metaDescription: "META_DESCRIPTION",
  slug: "SLUG",
  keywords: "KEYWORDS",
} as const;

/** `LABEL: value` on its own line, tolerant of surrounding whitespace and bold markers. */
export function readLabel(output: string, label: string): string | undefined {
  const m = new RegExp(`(?:^|\\n)\\s*\\**${label}\\**\\s*:\\s*(.+)`).exec(output);
  return m?.[1]?.trim() || undefined;
}

/**
 * Legacy Persian labels. Kept as a read-only fallback so a run already in
 * flight when this shipped — or a stored output produced before it — still
 * parses. Nothing writes these any more.
 */
export const LEGACY_FA_LABEL: Record<keyof typeof LABEL, string> = {
  finalTitle: "عنوان نهایی",
  score: "امتیاز",
  seoTitle: "عنوان سئو",
  metaDescription: "توضیحات متا",
  slug: "اسلاگ",
  keywords: "کلمات کلیدی",
};

/** Reads the new machine label, falling back to the Persian one it replaced. */
export function readPipelineField(output: string, field: keyof typeof LABEL): string | undefined {
  return readLabel(output, LABEL[field]) ?? readLabel(output, LEGACY_FA_LABEL[field]);
}
