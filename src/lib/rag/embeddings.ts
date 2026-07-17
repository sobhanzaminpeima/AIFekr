// Text embeddings for semantic retrieval (RAG), via Cohere's multilingual
// embed model — chosen because it handles Persian and English in the same
// vector space, and we already have a working COHERE_API_KEY + relay path
// (see providers.ts) for reaching Cohere from a sanctioned-IP server.
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
const COHERE_BASE = RELAY_BASE_URL ? `${RELAY_BASE_URL}/cohere` : "https://api.cohere.ai";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "";

export const hasEmbeddings = COHERE_API_KEY.length > 10;

/**
 * Embeds a single piece of text. Returns null (never throws) on any
 * failure — every call site must treat embeddings as best-effort and fall
 * back to recency ordering when this comes back null.
 */
export async function embedText(text: string, inputType: "search_document" | "search_query" = "search_document"): Promise<number[] | null> {
  if (!hasEmbeddings || !text.trim()) return null;

  try {
    const res = await fetch(`${COHERE_BASE}/v1/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "embed-multilingual-v3.0",
        texts: [text.slice(0, 8000)],
        input_type: inputType,
        embedding_types: ["float"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data.embeddings?.float?.[0] ?? data.embeddings?.[0];
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
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
