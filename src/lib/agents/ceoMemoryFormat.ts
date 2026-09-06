// The CEO orchestrator's memory protocol, kept in its own module with NO
// server-only imports (no prisma, no AI router) so client components can strip
// the machine-only section before rendering without pulling the server bundle
// across the boundary — the same mistake that broke every 404 page when
// `tri` was imported from the "use client" i18n index.

/**
 * The model is told to emit this verbatim, untranslated, ahead of its memory
 * notes. It replaces the old approach of matching a Persian Markdown heading:
 * that parser silently found nothing the moment the heading was translated,
 * which would have made the agent quietly stop learning in English and German
 * with no error anywhere.
 */
export const MEMORY_MARKER = "<<<MEMORY>>>";

export const MEMORY_CATEGORIES = ["sales", "content", "seo", "social", "dev", "general"] as const;

/** The Sales Agent keeps its own tags — same protocol, different category set. */
export const SALES_MEMORY_CATEGORIES = ["pipeline", "lead_source", "risk", "general"] as const;

/**
 * Parses the model's memory notes. Returns [] when the section is absent or
 * malformed. `categories` defaults to the CEO's set.
 */
export function extractMemoryLines(
  output: string,
  categories: readonly string[] = MEMORY_CATEGORIES,
): { category: string; text: string }[] {
  const idx = output.indexOf(MEMORY_MARKER);
  if (idx === -1) return [];
  const pattern = new RegExp(`^\\[(${categories.join("|")})\\]\\s*(.+)`);
  return output
    .slice(idx + MEMORY_MARKER.length)
    .split("\n")
    .map((l) => pattern.exec(l.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ category: m[1], text: m[2].trim() }));
}

/**
 * Removes the marker and everything after it. Anything rendered to a human —
 * the orchestrator page, the daily email — must go through this: the memory
 * notes are instructions to the next run, not part of the briefing.
 */
export function stripMemorySection(output: string): string {
  const idx = output.indexOf(MEMORY_MARKER);
  return (idx === -1 ? output : output.slice(0, idx)).trimEnd();
}
