/**
 * TypeSafe's Jev is not a chat or image-generation model. It evaluates a
 * supplied state against typed questions and returns probabilities for code.
 */
const TYPESAFE_BASE_URL = "https://api.typesafe.ai/v1";
const TYPESAFE_MODEL = "jev-latest";

export const isTypeSafeConfigured = (process.env.TYPESAFE_API_KEY || "").length > 10;

export type TypeSafeQuestion =
  | { type: "noul"; instructions: string; criteria?: unknown }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type TypeSafeResponse = {
  model: string;
  answers: Record<string, unknown>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export async function evaluateWithTypeSafe(state: string, questions: Record<string, TypeSafeQuestion>): Promise<TypeSafeResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY || "";
  if (!isTypeSafeConfigured) throw new Error("کلید API سرویس TypeSafe تنظیم نشده است");

  const response = await fetch(`${TYPESAFE_BASE_URL}/systemone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state, model: TYPESAFE_MODEL, questions }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: { message?: string } | string; message?: string };
      detail = typeof body.error === "string" ? body.error : body.error?.message || body.message || detail;
    } catch { /* Keep the HTTP status when the body is not JSON. */ }
    throw new Error(`آزمون TypeSafe ناموفق بود: ${detail}`);
  }
  return response.json() as Promise<TypeSafeResponse>;
}
