interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const RELAY_BASE_URL = process.env.AI_RELAY_BASE_URL || "";
// api.tavily.com is blocked at the network level from this server, same as
// Google/Groq/Cohere/OpenRouter — route through the relay VPS when configured.
const TAVILY_BASE_URL = RELAY_BASE_URL ? `${RELAY_BASE_URL}/tavily` : "https://api.tavily.com";

export const hasTavily = !!TAVILY_API_KEY;

/** Real live web search via Tavily (search API built for AI agents). Returns null if no key is configured — callers must fall back gracefully, not fail. */
export async function searchWeb(query: string, maxResults = 5): Promise<TavilyResponse | null> {
  if (!TAVILY_API_KEY) return null;

  try {
    const res = await fetch(`${TAVILY_BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: maxResults,
      }),
    });
    if (!res.ok) {
      console.error("Tavily search error:", res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Tavily search failed:", err);
    return null;
  }
}

/** Formats Tavily results as plain text ready to drop into an AI prompt, with sources so the model can cite them. */
export function formatSearchResultsForPrompt(response: TavilyResponse): string {
  const parts: string[] = [];
  if (response.answer) parts.push(`خلاصهٔ جستجو: ${response.answer}`);
  response.results.forEach((r, i) => {
    parts.push(`[منبع ${i + 1}] ${r.title}\n${r.content.slice(0, 500)}\nآدرس: ${r.url}`);
  });
  return parts.join("\n\n");
}
