import type { Lang } from "@/lib/i18n";

const LIST_SEPARATOR: Record<Lang, string> = { fa: "، ", en: ", ", de: ", ", tr: ", " };

/**
 * "{title} — {heading}" per source, deduped, joined with a locale-correct
 * separator. Several documents share an identical section heading --
 * "Where to find it" appears in nearly every capability doc -- so citing the
 * bare heading alone is ambiguous whenever more than one such hit comes back
 * (found while testing the floating widget against the real knowledge base:
 * three citations all reading "Where to find it", with no way to tell which
 * topic each belonged to). Falls back to the bare title for a document's
 * leading chunk, where heading === title already (see kb/parse.ts) and
 * repeating it would just read as "Accounting — Accounting".
 *
 * Extracted from the widget component as a pure function purely so it's
 * unit-testable without mounting React -- see formatSources.test.ts.
 */
export function formatSources(sources: { title: string; heading: string }[], lang: Lang): string {
  const labels = sources.map((s) => (s.title === s.heading ? s.heading : `${s.title} — ${s.heading}`));
  return Array.from(new Set(labels)).join(LIST_SEPARATOR[lang]);
}
