import ChatInterface from "@/components/chat/ChatInterface";
// tri must come from "@/lib/i18n/tri", NOT "@/lib/i18n": the index is a
// "use client" module, so a Server Component importing tri from it gets a
// client-reference proxy instead of the function and crashes at render.
import { tri } from "@/lib/i18n/tri";

import { ASSISTANT_CONFIGS, ASSISTANT_FALLBACK as FALLBACK } from "@/lib/chat/assistants";

export default async function AssistantPage(
  props: { params: Promise<{ type: string }>; searchParams?: Promise<{ lang?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // Try to read lang from cookie on the server side approximation; fall back to "fa"
  const lang = (searchParams?.lang as "fa" | "en" | "de" | "tr") || "fa";
  const config = ASSISTANT_CONFIGS[params.type] || FALLBACK;

  const title = tri(lang, config.titleFa, config.titleEn, config.titleDe);
  const systemPrompt = tri(lang, config.promptFa, config.promptEn, config.promptDe);

  return <ChatInterface systemPrompt={systemPrompt} title={title} />;
}
