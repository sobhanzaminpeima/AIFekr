import { PROVIDERS } from "./providers";
import { getCreditCosts } from "@/lib/utils/creditCosts";
/** Conservative server-owned bound across the existing fallback model chain. */
export async function mobileChatQuote() {
  const costs = await getCreditCosts();
  return { maxCredits: Math.max(costs.chat, ...PROVIDERS.map(p => p.creditCost)), currency: "credits", scope: "chat-only" };
}
