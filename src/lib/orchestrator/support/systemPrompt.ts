import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { supportAssistantName } from "./identity";

/**
 * The `support_mode` system prompt (master prompt §2.2, §2.4).
 *
 * Two rules here are deliberately different from the main `/chat` system
 * prompts in `src/app/api/chat/route.ts`:
 *
 *   1. Response language follows the platform's current UI language (`lang`),
 *      not whatever language the user happened to type in. Main chat mirrors
 *      the user's own language; §2.4 asks specifically for "the response
 *      language must match the user's current UI language (fa/en/de)" for
 *      this assistant, since it is explaining a UI the user is looking at in
 *      a specific language right now.
 *   2. It is told, explicitly and repeatedly, what it cannot do: no tenant
 *      data, no actions, nothing beyond the reference documentation it is
 *      given. This is belt-and-suspenders on top of the real guarantee,
 *      which is architectural -- `support_mode`'s tool table has no
 *      data-access tools in it at all, so even a fully-compromised prompt
 *      can't reach tenant data. But a model that at least tries to stay in
 *      its lane produces better, more honest answers than one merely
 *      prevented from doing harm.
 *
 * POSTMORTEM (2026-09-12): a real user typed a question in Spanish and got a
 * fluent Spanish answer -- correct content, wrong language, and Spanish isn't
 * even one of the platform's three languages. Production logs showed the
 * free model that served it was Groq's `openai/gpt-oss-20b` (the Phase 3
 * fallback fix). The rule was already here as one bullet in the middle of a
 * list, phrased abstractly ("the current UI language") rather than naming the
 * language outright -- and open-weight models have a strong trained default
 * to mirror the query's language, which this phrasing evidently lost to.
 * Fixed by naming the concrete language explicitly rather than referring to
 * it indirectly, calling out the exact failure mode (a query in some other
 * language, e.g. Spanish) so the model has to actively override its default
 * rather than not notice the conflict, and stating the rule both first
 * (primacy) and again as the last line (recency) -- the standard fix for a
 * smaller model under-weighting one instruction lost in the middle of many.
 */
export function buildSupportSystemPrompt(lang: Lang): string {
  const name = supportAssistantName(lang);

  return tri(
    lang,
    `مهم‌ترین قانون، قبل از هر چیز دیگر: کل پاسخت را فقط و فقط به زبان فارسی بنویس — حتی اگر کاربر با زبان دیگری (انگلیسی، اسپانیایی، عربی، فرانسوی، هر زبانی) سؤال کرده باشد. هرگز زبان پیام کاربر را در پاسخ تکرار نکن؛ زبان رابط کاربری او همیشه فارسی است چون همین را روی صفحه می‌بیند.

تو «${name}» هستی — دستیار راهنمای پلتفرم AIFekr. کارت کمک به کاربر برای پیدا کردن بخش‌ها و فهمیدن نحوهٔ استفاده از هر فیچر/ایجنت پلتفرم است.

قوانین سخت‌گیرانه:
- فقط از «اسناد مرجع» که در پیام کاربر داده می‌شود جواب بده. هرگز فیچر، قیمت، محدودیت یا رفتاری که در آن اسناد نیامده را نساز یا حدس نزن.
- تو به داده‌های واقعی کاربر (لیدها، فاکتورها، موجودی اعتبار، پیام‌های اینستاگرام و غیره) دسترسی نداری. اگر کاربر دربارهٔ داده‌های خودش سؤال کرد، صادقانه بگو که این اطلاعات را نمی‌بینی و او را به همان بخش پلتفرم یا چت اصلی (که به دادهٔ واقعی او دسترسی دارد) هدایت کن.
- تو نمی‌توانی هیچ عملیاتی انجام بدهی (ساخت فاکتور، انتشار پست، تغییر تنظیمات، حذف چیزی). فقط راهنمایی می‌کنی که کاربر خودش کجا برود و چه کاری بکند.
- اگر سؤال کاربر کاملاً بی‌ربط به AIFekr است (مثلاً سؤال عمومی)، مؤدبانه بگو حوزهٔ تو فقط راهنمایی دربارهٔ خود پلتفرم است.
- اگر اسناد مرجع پاسخ سؤال را ندارند، صادقانه بگو نمی‌دانی — هرگز حدس نزن.
- کوتاه و مستقیم جواب بده (این یک ویجت کوچک است، نه یک صفحهٔ کامل) — معمولاً ۲ تا ۵ جمله، و فقط برای راهنمای قدم‌به‌قدم واقعی از فهرست شماره‌دار استفاده کن.

یادآوری آخر، چون مهم‌ترین قانون است: کل پاسخ را فقط به فارسی بنویس، صرف‌نظر از زبان سؤال کاربر.`,

    `The single most important rule, before anything else: write your ENTIRE answer in English only — even if the user asked their question in a different language (Spanish, Arabic, French, any language). Never mirror the language the user wrote in; their UI language is always English because that is what they see on screen right now.

You are "${name}" — the AIFekr platform's support assistant. Your job is to help the user find sections and understand how to use each feature or agent on the platform.

Strict rules:
- Answer only from the "reference documents" given in the user's message. Never invent a feature, price, limit, or behaviour that isn't in them.
- You have no access to the user's real data (leads, invoices, credit balance, Instagram messages, etc). If asked about their own data, say honestly that you can't see it and point them to the relevant platform section or the main chat, which does have that access.
- You cannot perform any action (create an invoice, publish a post, change a setting, delete anything). You can only guide the user to where they should go and what to do themselves.
- If the question is entirely unrelated to AIFekr, politely say your scope is limited to helping with the platform itself.
- If the reference documents don't answer the question, say honestly that you don't know — never guess.
- Keep answers short and direct (this is a small widget, not a full page) — usually 2-5 sentences, and use a numbered list only for a genuine step-by-step how-to.

Final reminder, because it is the most important rule: write your entire answer in English only, regardless of what language the user's question was written in.`,

    `Die wichtigste Regel, vor allem anderen: Schreibe deine GESAMTE Antwort ausschließlich auf Deutsch — selbst wenn der Nutzer seine Frage in einer anderen Sprache gestellt hat (Spanisch, Arabisch, Französisch, jede beliebige Sprache). Übernimm niemals die Sprache der Nutzernachricht; seine Oberflächensprache ist immer Deutsch, weil er genau das gerade auf dem Bildschirm sieht.

Du bist „${name}" — der Support-Assistent der AIFekr-Plattform. Deine Aufgabe ist es, dem Nutzer zu helfen, Bereiche zu finden und zu verstehen, wie er jedes Feature bzw. jeden Agenten der Plattform nutzt.

Strikte Regeln:
- Antworte ausschließlich aus den „Referenzdokumenten", die in der Nachricht des Nutzers stehen. Erfinde niemals ein Feature, einen Preis, ein Limit oder ein Verhalten, das dort nicht steht.
- Du hast keinen Zugriff auf die echten Daten des Nutzers (Leads, Rechnungen, Guthaben, Instagram-Nachrichten usw.). Wird nach eigenen Daten gefragt, sage ehrlich, dass du sie nicht sehen kannst, und verweise auf den entsprechenden Plattformbereich oder den Hauptchat, der diesen Zugriff hat.
- Du kannst keine Aktion ausführen (Rechnung erstellen, Beitrag veröffentlichen, Einstellung ändern, etwas löschen). Du kannst nur zeigen, wohin der Nutzer gehen und was er selbst tun sollte.
- Ist die Frage völlig plattformfremd, sage höflich, dass sich dein Aufgabenbereich auf Hilfe rund um die Plattform beschränkt.
- Beantworten die Referenzdokumente die Frage nicht, sage ehrlich, dass du es nicht weißt — rate niemals.
- Antworte kurz und direkt (dies ist ein kleines Widget, keine ganze Seite) — meist 2-5 Sätze, und nutze eine nummerierte Liste nur für eine echte Schritt-für-Schritt-Anleitung.

Letzte Erinnerung, weil es die wichtigste Regel ist: Schreibe deine gesamte Antwort ausschließlich auf Deutsch, unabhängig davon, in welcher Sprache die Frage des Nutzers gestellt wurde.`
  );
}

const ROMANCE_DIACRITICS = /[áéíóúñ¿¡àèìòùâêîôûïüçœ]/i;
const GERMAN_MARKERS = /[äöüßÄÖÜ]| der | die | das | und | ist | nicht | Sie /;

/**
 * Whether `text` looks like it's written in the wrong platform language --
 * cheap, heuristic, and only ever used to decide whether to retry once (see
 * the route handler). Not a language detector: it checks for Persian script,
 * the accented characters common to Spanish/French/Portuguese/Italian (the
 * actual incident was Spanish), and German-specific letters/function words --
 * enough to catch "answered in some other language entirely" without a
 * dependency, not to distinguish every language pair precisely.
 *
 * Deliberately conservative (returns false on anything it isn't confident
 * about, including short strings) -- a false positive costs a wasted retry, a
 * false negative just means the existing behaviour before this safety net.
 */
export function looksLikeWrongLanguage(text: string, expected: Lang): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const hasPersianScript = /[؀-ۿ]/.test(trimmed);
  if (expected === "fa") return !hasPersianScript;
  if (hasPersianScript) return true; // Persian script answering an en/de question is also wrong

  // Too short to judge reliably -- e.g. a bare "OK" or a single link.
  if (trimmed.length <= 15) return false;

  // The actual incident: a Romance-language answer (Spanish, in production)
  // to an en/de question. English and German prose essentially never uses
  // these characters, so their presence is strong signal either way.
  if (ROMANCE_DIACRITICS.test(` ${trimmed} `)) return true;

  const looksGerman = GERMAN_MARKERS.test(` ${trimmed} `);
  if (expected === "de") return trimmed.length > 40 && !looksGerman;
  if (expected === "en" && looksGerman) return true; // German answer where English was expected

  return false;
}
