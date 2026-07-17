import { embedText, cosineSimilarity, parseEmbedding } from "./embeddings";

interface Embeddable {
  text: string;
  embedding: string | null;
  createdAt: Date;
}

/**
 * Ranks candidate rows by semantic relevance to `query`, falling back to
 * recency (the order `candidates` is already in) when embeddings aren't
 * available — either because Cohere is unreachable right now, or because
 * older rows were written before embedding generation existed.
 *
 * `candidates` should already be recency-ordered (desc) and reasonably
 * capped (e.g. last 30-60) — this re-ranks within that window rather than
 * scanning the whole table, so it stays cheap even for long-lived accounts.
 */
export async function rankByRelevance<T extends Embeddable>(candidates: T[], query: string, take: number): Promise<T[]> {
  if (candidates.length <= take) return candidates;

  const queryVec = await embedText(query, "search_query");
  if (!queryVec) return candidates.slice(0, take);

  const scored = candidates.map((c) => {
    const vec = parseEmbedding(c.embedding);
    const score = vec ? cosineSimilarity(queryVec, vec) : -1; // rows without an embedding sort last
    return { item: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, take).map((s) => s.item);
}

/** Best-effort embedding for a row at write time — never blocks or throws on failure. */
export async function embedForStorage(text: string): Promise<string | null> {
  const vec = await embedText(text, "search_document");
  return vec ? JSON.stringify(vec) : null;
}
