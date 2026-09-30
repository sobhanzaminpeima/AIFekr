import { prisma } from "@/lib/db/prisma";
import { embedText, cosineSimilarity, parseEmbedding } from "@/lib/rag/embeddings";
import type { Lang } from "@/lib/i18n";
import { CAPABILITIES, getCapability } from "../registry";

/**
 * Retrieval for the floating support assistant.
 *
 * Hybrid on purpose. `embedText()` returns null rather than throwing whenever
 * Cohere is unreachable (sanctioned-IP relay down, rate limit, missing key),
 * and chunks written during such a window have no vector at all. A
 * vector-only retriever would answer "I don't know" for the entire knowledge
 * base in exactly the situation where a user most needs help, so every chunk
 * also gets a language-agnostic keyword score and the two are combined.
 *
 * The corpus is small by design — roughly 15 documents x 3 languages x ~5
 * sections — so one language's chunks are loaded and scored in memory. That is
 * a few hundred rows; there is no index to maintain and no pgvector to run.
 * If the doc-set ever grows past a few thousand chunks per language this is
 * the function to revisit, not the storage format.
 */

export interface KbHit {
  slug: string;
  /** The document's own title -- needed alongside `heading` for citations, since several documents share an identical section heading ("Where to find it" appears in nearly every capability doc); citing the bare heading alone is ambiguous when more than one such hit is returned. */
  title: string;
  heading: string;
  text: string;
  score: number;
  /** Where this topic lives in the product, when the doc maps to one capability. */
  href: string | null;
  capabilityKey: string | null;
}

/**
 * Splits on anything that isn't a letter or digit, covering all three
 * platform languages: ASCII, Latin-1/Extended (German umlauts and ß), and the
 * Arabic/Persian blocks including presentation forms.
 *
 * Spelled out as ranges rather than `\p{L}\p{N}` with the `u` flag because
 * this project's tsconfig sets no `target`, so TypeScript compiles against
 * ES5 where unicode property escapes are a compile error. Same reason
 * `Array.from` appears below instead of spreading a Set.
 */
const WORD_SEPARATOR = /[^0-9a-zÀ-ɏ؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((t) => t.length > 1);
}

/**
 * Fraction of the query's distinct terms that appear in the chunk. Crude, but
 * it is only ever a fallback or a tie-breaker, and it degrades gracefully in
 * all three languages without a stemmer.
 */
function keywordScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set(tokenize(text));
  let hits = 0;
  for (const t of queryTokens) if (haystack.has(t)) hits += 1;
  return hits / queryTokens.length;
}

export async function searchKb(query: string, lang: Lang, take = 5): Promise<KbHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const chunks = await prisma.kbChunk.findMany({
    where: { document: { lang } },
    select: {
      heading: true,
      text: true,
      embedding: true,
      document: { select: { slug: true, title: true, capabilityKey: true } },
    },
  });
  if (chunks.length === 0) return [];

  const queryVec = await embedText(trimmed, "search_query");
  const queryTokens = Array.from(new Set(tokenize(trimmed)));

  const scored = chunks.map((c) => {
    const kw = keywordScore(queryTokens, c.text);
    const vec = queryVec ? parseEmbedding(c.embedding) : null;
    // Cohere similarities for related text sit high and in a narrow band, so
    // semantic match carries most of the weight and keywords break ties —
    // except for a chunk with no vector, where keywords are all there is.
    const score = vec ? 0.75 * cosineSimilarity(queryVec!, vec) + 0.25 * kw : kw;
    return { chunk: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, take)
    .map(({ chunk, score }) => {
      const cap = chunk.document.capabilityKey ? getCapability(chunk.document.capabilityKey) : undefined;
      return {
        slug: chunk.document.slug,
        title: chunk.document.title,
        heading: chunk.heading,
        text: chunk.text,
        score,
        href: cap?.href ?? null,
        capabilityKey: chunk.document.capabilityKey,
      };
    });
}

/**
 * Registry entries whose label or blurb matches the query, in the user's
 * language. Runs alongside `searchKb` so "where is the CRM" resolves to a real
 * destination even before a single document has been written — the registry is
 * always present, the doc-set is content that can lag behind it.
 */
export function searchCapabilities(query: string, lang: Lang, take = 3) {
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return [];

  return CAPABILITIES.map((cap) => ({
    cap,
    score: keywordScore(queryTokens, `${cap.label(lang)} ${cap.blurb(lang)} ${cap.key}`),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map((r) => r.cap);
}
