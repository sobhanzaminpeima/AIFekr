import type { Lang } from "@/lib/i18n";

/**
 * Parser for the knowledge-base doc-set (`docs/knowledge-base/*.md`).
 *
 * One file per topic holds all three languages side by side rather than
 * `crm.fa.md` / `crm.en.md` / `crm.de.md`. That is a deliberate maintenance
 * choice: this project has a documented history of German silently going
 * stale (see commit e24f208, "five agents dropped German on the floor"), and
 * a translator who can see all three blocks in one file while editing is far
 * less likely to leave one behind. The sync route also reports any file
 * missing a language, so a gap is loud rather than silent.
 *
 * File shape:
 *
 *     ---
 *     slug: crm
 *     capability: crm
 *     ---
 *
 *     <!--lang:fa-->
 *     # عنوان سند
 *     ### یک بخش
 *     متن ...
 *
 *     <!--lang:en-->
 *     # Document title
 *     ### A section
 *     text ...
 *
 *     <!--lang:de-->
 *     ...
 *
 * Deliberately free of fs/Prisma imports so it is unit-testable as a pure
 * function — see parse.test.ts.
 */

export const KB_LANGS: Lang[] = ["fa", "en", "de"];

export interface ParsedChunk {
  ordinal: number;
  /** The `###` heading, used as the citation label. */
  heading: string;
  /** Heading + body, so an embedded chunk carries its own topic. */
  text: string;
}

export interface ParsedBlock {
  lang: Lang;
  title: string;
  /** Raw source of this language block, hashed to skip unchanged blocks wholesale. */
  raw: string;
  chunks: ParsedChunk[];
}

export interface ParsedDocument {
  slug: string;
  /** Capability key from frontmatter, or null for cross-cutting docs. */
  capabilityKey: string | null;
  blocks: ParsedBlock[];
  /** Languages declared in the registry but absent from this file. */
  missingLangs: Lang[];
}

const LANG_MARKER = /^<!--\s*lang:(fa|en|de)\s*-->\s*$/;

function parseFrontmatter(lines: string[]): { meta: Record<string, string>; rest: string[] } {
  if (lines[0]?.trim() !== "---") return { meta: {}, rest: lines };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return { meta: {}, rest: lines };

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return { meta, rest: lines.slice(end + 1) };
}

/**
 * Splits one language block into chunks, one per `###` section. Body text
 * appearing before the first `###` becomes a leading chunk headed by the
 * document title, so an intro paragraph is never dropped.
 *
 * The embedded text is prefixed with the document title as well as the section
 * heading. That is not cosmetic: several documents use the same section
 * headings by design ("Where to find it" appears in every capability doc, and
 * in Persian they are all the identical single word "کجاست؟"). Embedding the
 * heading alone made those chunks near-identical vectors, so the Persian query
 * "where are invoices?" retrieved the "where is it?" section of Social,
 * CRM and Industry packs and missed Accounting entirely — measured against the
 * real index on 2026-09-11. Prefixing the title is what separates them.
 */
function chunkBlock(title: string, bodyLines: string[]): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let heading = title;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!body) return;
    const context = heading === title ? title : `${title} — ${heading}`;
    chunks.push({ ordinal: chunks.length, heading, text: `${context}\n${body}` });
  };

  for (const line of bodyLines) {
    if (line.startsWith("### ")) {
      flush();
      heading = line.slice(4).trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
}

export function parseKbDocument(slug: string, source: string): ParsedDocument {
  const { meta, rest } = parseFrontmatter(source.split(/\r?\n/));

  // Group the remaining lines by the <!--lang:xx--> marker that precedes them.
  const byLang = new Map<Lang, string[]>();
  let current: Lang | null = null;
  for (const line of rest) {
    const marker = line.match(LANG_MARKER);
    if (marker) {
      current = marker[1] as Lang;
      if (!byLang.has(current)) byLang.set(current, []);
      continue;
    }
    if (current) byLang.get(current)!.push(line);
  }

  const blocks: ParsedBlock[] = [];
  for (const lang of KB_LANGS) {
    const lines = byLang.get(lang);
    if (!lines) continue;

    const titleIdx = lines.findIndex((l) => l.startsWith("# "));
    const title = titleIdx === -1 ? slug : lines[titleIdx].slice(2).trim();
    const body = titleIdx === -1 ? lines : lines.slice(titleIdx + 1);
    const chunks = chunkBlock(title, body);
    if (chunks.length === 0) continue;

    blocks.push({ lang, title, raw: lines.join("\n").trim(), chunks });
  }

  return {
    slug: meta.slug || slug,
    capabilityKey: meta.capability || null,
    blocks,
    missingLangs: KB_LANGS.filter((l) => !blocks.some((b) => b.lang === l)),
  };
}
