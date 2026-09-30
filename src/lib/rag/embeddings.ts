// Text embeddings for semantic retrieval (RAG), via Cohere's multilingual
// embed model — chosen because it handles Persian and English in the same
// vector space, and we already have a working COHERE_API_KEY + relay path
// (see providers.ts) for reaching Cohere from a sanctioned-IP server.
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
const COHERE_BASE = RELAY_BASE_URL ? `${RELAY_BASE_URL}/cohere` : "https://api.cohere.ai";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "";

export const hasEmbeddings = COHERE_API_KEY.length > 10;

/** Cohere's /v1/embed accepts up to 96 texts per request. */
const MAX_BATCH = 96;

async function embedBatch(texts: string[], inputType: "search_document" | "search_query"): Promise<(number[] | null)[]> {
  try {
    const res = await fetch(`${COHERE_BASE}/v1/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "embed-multilingual-v3.0",
        texts: texts.map((t) => t.slice(0, 8000)),
        input_type: inputType,
        embedding_types: ["float"],
      }),
    });
    if (!res.ok) return texts.map(() => null);
    const data = await res.json();
    const vectors = data.embeddings?.float ?? data.embeddings;
    if (!Array.isArray(vectors)) return texts.map(() => null);
    return texts.map((_, i) => (Array.isArray(vectors[i]) ? vectors[i] : null));
  } catch {
    return texts.map(() => null);
  }
}

/**
 * Embeds many texts at once, in chunks of 96, preserving input order.
 * Entries that couldn't be embedded come back as null rather than throwing.
 *
 * Worth using over a loop of `embedText` for anything bulk: Cohere's free tier
 * caps *requests* per minute, not texts, so indexing 222 knowledge-base chunks
 * one at a time stops dead at exactly 100 embedded and silently leaves the
 * rest without vectors (measured, 2026-09-11). The same work as three batched
 * requests stays comfortably inside the limit.
 */
export async function embedTexts(texts: string[], inputType: "search_document" | "search_query" = "search_document"): Promise<(number[] | null)[]> {
  if (!hasEmbeddings) return texts.map(() => null);

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  // Empty strings are filtered out rather than sent — Cohere rejects the whole
  // batch if any text is blank, which would lose every vector in that batch.
  const indexed = texts.map((t, i) => ({ t, i })).filter(({ t }) => t.trim().length > 0);

  for (let start = 0; start < indexed.length; start += MAX_BATCH) {
    const slice = indexed.slice(start, start + MAX_BATCH);
    const vectors = await embedBatch(slice.map((s) => s.t), inputType);
    slice.forEach((s, k) => {
      results[s.i] = vectors[k];
    });
  }

  return results;
}

/**
 * Embeds a single piece of text. Returns null (never throws) on any
 * failure — every call site must treat embeddings as best-effort and fall
 * back to recency ordering when this comes back null.
 */
export async function embedText(text: string, inputType: "search_document" | "search_query" = "search_document"): Promise<number[] | null> {
  if (!hasEmbeddings || !text.trim()) return null;
  return (await embedTexts([text], inputType))[0];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function parseEmbedding(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
