import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { searchKb } from "./search";

/**
 * Grounds the MAIN chat (`/chat`) in the real product knowledge base when — and
 * only when — the user is asking about AIFekr itself.
 *
 * Found by QA on 2026-09-15 (finding U10): asked what AIFekr can do, the main
 * chat had no idea and asked the user to supply an official source. The
 * knowledge base that answers exactly this already existed, but was wired only
 * to the floating support widget (`/api/support/chat`), never to the main chat
 * the user actually talks to first.
 *
 * Retrieval is gated behind a keyword pre-filter rather than run on every
 * message: `searchKb` loads and scores a language's whole chunk set and calls
 * the embedding provider, which is real latency and cost to pay on "سلام".
 * The filter only has to be good enough to catch questions *about the
 * platform* — a miss costs the old behaviour, not a wrong answer.
 */

const PRODUCT_TERMS = [
  "aifekr", "ai fekr", "ای‌فکر", "ایفکر", "آی‌فکر", "آیفکر",
  "این پلتفرم", "این سایت", "این سرویس", "این محصول", "این برنامه",
  "this platform", "this product", "this app", "this service", "this website",
  "diese plattform", "dieses produkt", "diese app",
];

/** Words that make a message a question ABOUT a product rather than a task for the assistant. */
const CAPABILITY_TERMS = [
  "چیکار", "چه کار", "چی کار", "قابلیت", "امکانات", "فیچر", "چیه", "چیست", "معرفی",
  "کجاست", "کجا پیدا", "چطور استفاده", "چگونه استفاده", "پلن", "تعرفه", "اشتراک",
  "what can", "what is", "what does", "features", "capabilities", "how do i use",
  "where do i find", "where is", "pricing", "plans", "subscription",
  "was kann", "was ist", "funktionen", "wo finde", "preise", "tarife",
];

export function looksLikeProductQuestion(message: string): boolean {
  const m = message.toLowerCase();
  if (!PRODUCT_TERMS.some((t) => m.includes(t))) return false;
  return CAPABILITY_TERMS.some((t) => m.includes(t));
}

/**
 * Reference material to append to the system prompt, or "" when the message
 * isn't about the platform or the knowledge base has nothing relevant.
 *
 * Never throws: a chat message must still get answered if retrieval fails, so
 * a failure here degrades to the pre-existing (ungrounded) behaviour.
 */
export async function buildProductKnowledgeBlock(message: string, lang: Lang): Promise<string> {
  if (!looksLikeProductQuestion(message)) return "";

  let hits;
  try {
    hits = await searchKb(message, lang, 4);
  } catch (err) {
    console.warn("[chat] product KB lookup failed, answering without it:", err);
    return "";
  }
  if (hits.length === 0) return "";

  const docs = hits
    .map((h) => `### ${h.title} — ${h.heading}${h.href ? ` (${h.href})` : ""}\n${h.text}`)
    .join("\n\n");

  return tri(
    lang,
    `\n\n---\nاطلاعات رسمی دربارهٔ خود پلتفرم AIFekr (از مستندات داخلی محصول):\n\n${docs}\n\nوقتی کاربر دربارهٔ خود AIFekr می‌پرسد، فقط از همین اطلاعات جواب بده و مسیر مربوطه را هم بگو. هرگز فیچر، قیمت یا محدودیتی که اینجا نیامده از خودت نساز؛ اگر اینجا نبود، صادقانه بگو نمی‌دانی.`,
    `\n\n---\nAuthoritative information about the AIFekr platform itself (from the product's own documentation):\n\n${docs}\n\nWhen the user asks about AIFekr itself, answer only from this material and point them to the relevant section. Never invent a feature, price, or limit that isn't here — if it isn't, say honestly that you don't know.`,
    `\n\n---\nVerbindliche Informationen über die AIFekr-Plattform selbst (aus der Produktdokumentation):\n\n${docs}\n\nWenn der Nutzer nach AIFekr selbst fragt, antworte ausschließlich auf Basis dieses Materials und nenne den passenden Bereich. Erfinde niemals ein Feature, einen Preis oder ein Limit, das hier nicht steht — steht es nicht hier, sage ehrlich, dass du es nicht weißt.`
  );
}
