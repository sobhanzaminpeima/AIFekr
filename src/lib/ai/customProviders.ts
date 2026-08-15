import { prisma } from "@/lib/db/prisma";
import { streamOpenAICompat, type ChatMessage, type Provider } from "@/lib/ai/providers";

/** True for the "custom:<id>" model strings /api/ai/chat-providers hands out for admin-added providers. */
export function isCustomProviderModel(model: string | undefined): model is string {
  return !!model && model.startsWith("custom:");
}

/**
 * Streams a chat completion through an admin-added CustomAiProvider (any
 * OpenAI-compatible /chat/completions endpoint) instead of the static
 * PROVIDERS routing table. Callers should check isCustomProviderModel()
 * first and fall back to routedStreamChat() for anything else — this
 * intentionally has no fallback chain of its own since the admin picked
 * this specific provider on purpose.
 */
export async function streamCustomProvider(
  model: string,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const id = model.slice("custom:".length);
  const row = await prisma.customAiProvider.findUnique({ where: { id } });
  if (!row || !row.enabled) throw new Error("این مدل سفارشی دیگر در دسترس نیست");

  const provider: Provider = {
    id: `custom:${row.id}`,
    name: row.name,
    model: row.model,
    provider: "custom",
    baseURL: row.baseUrl,
    apiKey: row.apiKey,
    strengths: [],
    maxTokens: 4096,
    creditCost: 3,
  };

  await streamOpenAICompat(provider, messages, systemPrompt, onChunk);
}
