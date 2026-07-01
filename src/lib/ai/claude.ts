import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
} as const;

export type ModelKey = keyof typeof MODELS;

export function getModelForPlan(plan: string): string {
  switch (plan) {
    case "PRO":
    case "TEAM":
      return MODELS.opus;
    case "BASIC":
      return MODELS.sonnet;
    default:
      return MODELS.haiku;
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamChat(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  onChunk: (text: string) => void
): Promise<{ totalTokens: number }> {
  let totalTokens = 0;

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      onChunk(chunk.delta.text);
    }
    if (chunk.type === "message_delta" && chunk.usage) {
      totalTokens = chunk.usage.output_tokens;
    }
  }

  return { totalTokens };
}

export async function translatePrompt(persianText: string): Promise<string> {
  const message = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Translate this Persian text to English for an AI image generation prompt. Return ONLY the translated prompt, nothing else:\n\n${persianText}`,
      },
    ],
  });

  const content = message.content[0];
  return content.type === "text" ? content.text : persianText;
}
