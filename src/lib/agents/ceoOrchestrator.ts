import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildBusinessSnapshot, BusinessSnapshot } from "@/lib/agents/businessSnapshot";
import { hasTavily, searchWeb, formatSearchResultsForPrompt } from "@/lib/search/tavily";
import { embedForStorage } from "@/lib/rag/retrieve";
import { sanitizeFreeText } from "@/lib/agents/crmAgent";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";
import { MEMORY_MARKER, extractMemoryLines } from "@/lib/agents/ceoMemoryFormat";

// Phase 5, proposal 1 — the CEO Orchestrator used to take no language
// parameter at all: SYSTEM was a fixed Persian string and the output headings
// were Persian, so a German user's daily briefing (the platform's flagship
// "your AI team" feature) arrived in Persian. Note this is a different path
// from the CEO *Advisor* at /api/ceo/question, which was already trilingual.

/**
 * Existing memories stay in whatever language they were written in — the user
 * chose not to translate them on read (Phase 5 decision, option A), because
 * rewriting them would cost an API call per run and models handle mixed-language
 * context well. The prompt says so explicitly so the model treats a Persian
 * memory as meaningful context rather than as noise to ignore.
 */
const MIXED_LANGUAGE_NOTE: Record<Lang, string> = {
  fa: "حافظه و درس‌های زیر ممکن است به زبان دیگری (انگلیسی یا آلمانی) نوشته شده باشند — مفهومشان را در نظر بگیر، ولی پاسخ خودت را کاملاً فارسی بنویس.",
  en: "The memories and lessons below may be written in another language (Persian or German) — use their meaning as context, but write your own answer entirely in English.",
  de: "Die folgenden Erinnerungen und Erkenntnisse können in einer anderen Sprache (Persisch oder Englisch) verfasst sein — nutze ihren Inhalt als Kontext, schreibe deine eigene Antwort aber vollständig auf Deutsch.",
};

function systemPrompt(lang: Lang): string {
  const role = tri(lang,
    `تو "مدیرعامل" (CEO) یک سیستم چندعامله (multi-agent) هستی که وضعیت واقعی کسب‌وکار کاربر را از چند ابزار مختلف (دکتر کسب‌وکار، تولید محتوا، شبکه‌های اجتماعی، CRM فروش، آمار مصرف و درآمد، پایداری سرویس پلتفرم، و در صورت وجود، جستجوی زندهٔ وب برای بازار و رقبا) دریافت می‌کنی.
وظیفهٔ تو: بر اساس این داده‌های واقعی و حافظهٔ مشترک تجمیع‌شده از تحلیل‌های قبلی، مشخص کن الان چه چیزی بیشترین نیاز به توجه دارد و چه تصمیماتی باید گرفته شود.
اگر داده‌ای برای یک بخش موجود نیست، آن را نادیده بگیر — هرگز داده یا آماری که در ورودی نیامده را نساز.
اگر نتایج جستجوی وب دربارهٔ بازار/رقبا داده شده، آن‌ها را در یک بخش «تحلیل بازار و رقبا» جداگانه در همان خروجی خلاصه کن و به منابع اشاره کن.
مبالغ را دقیقاً با همان واحد پولی که در ورودی آمده گزارش کن؛ واحد را عوض نکن و نرخ تبدیل نساز.
کل پاسخ را کاملاً به فارسی بنویس.`,

    `You are the "CEO" of a multi-agent system. You receive the real state of the user's business from several tools (business doctor, content production, social media, sales CRM, usage and revenue figures, platform service reliability, and — when available — live web search about the market and competitors).
Your job: based on this real data and the shared memory accumulated from previous analyses, determine what most needs attention right now and what decisions should be made.
If data for a section is missing, skip that section — never invent a figure or statistic that was not in the input.
If web search results about the market or competitors were provided, summarise them in a separate "Market and competitor analysis" section within the same output and cite the sources.
Report every amount in exactly the currency given in the input; never switch currency or invent an exchange rate.
Write your entire answer in English.`,

    `Du bist der „CEO" eines Multi-Agenten-Systems. Du erhältst den tatsächlichen Zustand des Unternehmens aus mehreren Werkzeugen (Business Doctor, Content-Produktion, Social Media, Vertriebs-CRM, Nutzungs- und Umsatzzahlen, Stabilität der Plattformdienste und — sofern verfügbar — Live-Websuche zu Markt und Wettbewerb).
Deine Aufgabe: Bestimme auf Basis dieser realen Daten und des gemeinsamen Gedächtnisses aus früheren Analysen, was jetzt die meiste Aufmerksamkeit braucht und welche Entscheidungen zu treffen sind.
Fehlen Daten zu einem Abschnitt, lasse ihn weg — erfinde niemals eine Zahl oder Statistik, die nicht in der Eingabe stand.
Wurden Websuchergebnisse zu Markt oder Wettbewerb bereitgestellt, fasse sie in einem eigenen Abschnitt „Markt- und Wettbewerbsanalyse" innerhalb derselben Ausgabe zusammen und nenne die Quellen.
Gib jeden Betrag exakt in der Währung an, die in der Eingabe steht; wechsle niemals die Währung und erfinde keinen Umrechnungskurs.
Schreibe deine gesamte Antwort auf Deutsch.`);

  const structure = tri(lang,
    `خروجی را دقیقاً با این ساختار Markdown بده:
## خلاصهٔ وضعیت
(۲ تا ۳ جمله)

## اولویت‌های فوری
۱. ...
۲. ...
۳. ...

## پیش‌نویس پیام پیگیری برای مخاطبان فروش
(اگر مخاطبی نیاز به پیگیری دارد، برای هرکدام یک پیام کوتاه و دوستانهٔ آمادهٔ ارسال بنویس — کاربر خودش آن را بازبینی و ارسال می‌کند)
**[نام مخاطب]:** [متن پیام]

## تحلیل توسعه‌دهنده (پایداری سرویس)
(اگر داده‌ای دربارهٔ قطعی/افت سرویس provider های هوش مصنوعی پلتفرم داده شده، بگو کدام provider بیشترین مشکل را داشته و یک پیشنهاد فنی کوتاه بده — اگر داده‌ای نیست، این بخش را کلاً حذف کن)

## تصمیمات پیشنهادی
- ...`,

    `Structure the output exactly as this Markdown:
## Situation summary
(2-3 sentences)

## Immediate priorities
1. ...
2. ...
3. ...

## Draft follow-up messages for sales contacts
(For each contact who needs following up, write one short, friendly, ready-to-send message — the user reviews and sends it themselves)
**[Contact name]:** [message text]

## Engineering note (service reliability)
(If data about AI provider outages or degradation was given, say which provider had the most trouble and give one short technical suggestion — if there is no such data, omit this section entirely)

## Suggested decisions
- ...`,

    `Gliedere die Ausgabe exakt nach diesem Markdown:
## Lagebericht
(2-3 Sätze)

## Sofortige Prioritäten
1. ...
2. ...
3. ...

## Entwürfe für Follow-up-Nachrichten an Vertriebskontakte
(Schreibe für jeden Kontakt, der ein Follow-up braucht, eine kurze, freundliche, versandfertige Nachricht — der Nutzer prüft und versendet sie selbst)
**[Name des Kontakts]:** [Nachrichtentext]

## Technischer Hinweis (Dienststabilität)
(Wenn Daten zu Ausfällen oder Einschränkungen der KI-Anbieter vorliegen, nenne den Anbieter mit den meisten Problemen und gib einen kurzen technischen Vorschlag — liegen keine solchen Daten vor, lasse diesen Abschnitt ganz weg)

## Vorgeschlagene Entscheidungen
- ...`);

  const memoryRule = tri(lang,
    `${MEMORY_MARKER}
(۲ تا ۴ نکتهٔ کوتاه و عملی که باید در تحلیل‌های بعدی به یاد داشته باشی — هر نکته در یک خط، با پیشوند دسته‌بندی به این شکل دقیق: [sales]، [content]، [seo]، [social]، [dev]، یا [general])
خطِ ${MEMORY_MARKER} را عیناً و بدون تغییر بنویس؛ ترجمه‌اش نکن.`,

    `${MEMORY_MARKER}
(2-4 short, actionable notes to remember in future analyses — one per line, each prefixed with a category exactly like this: [sales], [content], [seo], [social], [dev], or [general])
Emit the ${MEMORY_MARKER} line verbatim; do not translate it.`,

    `${MEMORY_MARKER}
(2-4 kurze, umsetzbare Notizen, die du dir für künftige Analysen merken sollst — je eine pro Zeile, jeweils mit einer Kategorie exakt so vorangestellt: [sales], [content], [seo], [social], [dev] oder [general])
Gib die Zeile ${MEMORY_MARKER} wortwörtlich aus; übersetze sie nicht.`);

  return `${role}\n\n${structure}\n\n${memoryRule}`;
}

/**
 * Amounts are labelled with the currency they are actually stored in and
 * formatted for the reader's locale — Persian numerals only for an Iranian
 * currency read in Persian, matching the rule used everywhere else after the
 * Phase 4 currency fix. Previously every figure was rendered `fa-IR` + "تومان"
 * regardless of the reader or the underlying currency.
 */
function money(amount: number, lang: Lang, currency = "IRT"): string {
  const iranian = currency === "IRT" || currency === "IRR";
  const locale = iranian && lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const word = iranian
    ? tri(lang, currency === "IRR" ? "ریال" : "تومان", currency === "IRR" ? "Rial" : "Toman", currency === "IRR" ? "Rial" : "Toman")
    : currency;
  return `${Math.round(amount).toLocaleString(locale)} ${word}`;
}

function buildCeoPrompt(snapshot: BusinessSnapshot, marketResearch: string | null, lang: Lang): string {
  const memoryLines = (snapshot.memories || []).map((m) => `[${m.category}] ${m.text}`).join("\n");
  const lessonLines = (snapshot.contentLessons || []).map((l) => `[${l.agentKey}] ${l.text}`).join("\n");
  const none = tri(lang, "هیچ‌کدام", "none", "keine");

  const L = tri(lang,
    { doctor: "دکتر کسب‌وکار", analyses: "تحلیل ثبت‌شده", latest: "آخرین مورد", content: "محتوا", posts: "مقاله منتشرشده", recentTitles: "عناوین اخیر", social: "شبکه‌های اجتماعی", socialPosts: "پست تولیدشده", topics: "موضوعات اخیر", sales: "فروش (CRM)", contacts: "مخاطب ثبت‌شده", needFollowUp: "مورد نیاز به پیگیری", pipeline: "Pipeline فروش", openValue: "ارزش معاملات باز", deals: "معامله", winRate: "نرخ برد ۹۰ روز اخیر", noData: "داده‌ای موجود نیست", stale: "معاملات راکد", days: "روز", perf: "دیتا و عملکرد (۳۰ روز اخیر)", revenue: "درآمد موفق", events: "تعداد فعالیت ثبت‌شده", issues: "تعداد قطعی/افت سرویس AI پلتفرم", breakdown: "تفکیک", times: "بار", header: "داده‌های واقعی فعلی کسب‌وکار", mem: "حافظهٔ مشترک از تحلیل‌های قبلی", lessons: "درس‌های تیم تولید محتوا (از منتقد خط تولید)", market: "نتایج جستجوی زندهٔ وب دربارهٔ بازار و رقبا" },
    { doctor: "Business doctor", analyses: "analyses on record", latest: "most recent", content: "Content", posts: "articles published", recentTitles: "recent titles", social: "Social media", socialPosts: "posts generated", topics: "recent topics", sales: "Sales (CRM)", contacts: "contacts on record", needFollowUp: "needing follow-up", pipeline: "Sales pipeline", openValue: "open deal value", deals: "deals", winRate: "win rate, last 90 days", noData: "no data available", stale: "stale deals", days: "days", perf: "Data and performance (last 30 days)", revenue: "successful revenue", events: "logged activity events", issues: "platform AI service outages/degradations", breakdown: "breakdown", times: "times", header: "Current real business data", mem: "Shared memory from previous analyses", lessons: "Lessons from the content production team (recorded by the pipeline's critic)", market: "Live web search results about the market and competitors" },
    { doctor: "Business Doctor", analyses: "erfasste Analysen", latest: "zuletzt", content: "Content", posts: "veröffentlichte Artikel", recentTitles: "aktuelle Titel", social: "Social Media", socialPosts: "erstellte Beiträge", topics: "aktuelle Themen", sales: "Vertrieb (CRM)", contacts: "erfasste Kontakte", needFollowUp: "benötigen ein Follow-up", pipeline: "Vertriebs-Pipeline", openValue: "Wert offener Deals", deals: "Deals", winRate: "Gewinnrate, letzte 90 Tage", noData: "keine Daten verfügbar", stale: "liegengebliebene Deals", days: "Tage", perf: "Daten und Leistung (letzte 30 Tage)", revenue: "erfolgreicher Umsatz", events: "erfasste Aktivitäten", issues: "Ausfälle/Einschränkungen der KI-Dienste", breakdown: "Aufschlüsselung", times: "mal", header: "Aktuelle reale Geschäftsdaten", mem: "Gemeinsames Gedächtnis aus früheren Analysen", lessons: "Erkenntnisse des Content-Teams (vom Kritiker der Pipeline erfasst)", market: "Live-Websuchergebnisse zu Markt und Wettbewerb" });

  const sep = tri(lang, "، ", ", ", ", ");

  return `${L.header}:

**${L.doctor}:** ${snapshot.businessDoctor.totalAnalyses} ${L.analyses}${snapshot.businessDoctor.latest ? `${sep}${L.latest}: ${snapshot.businessDoctor.latest.businessName} (${snapshot.businessDoctor.latest.industry})` : ""}

**${L.content}:** ${snapshot.content.totalPosts} ${L.posts}. ${L.recentTitles}: ${snapshot.content.latest.map((p) => p.title).join(sep) || none}

**${L.social}:** ${snapshot.social.totalPosts} ${L.socialPosts}. ${L.topics}: ${snapshot.social.latest.map((s) => s.topic).join(sep) || none}

**${L.sales}:** ${snapshot.sales.totalContacts} ${L.contacts}${sep}${snapshot.sales.needingFollowUp.length} ${L.needFollowUp}: ${snapshot.sales.needingFollowUp.map((l) => `${l.name} (${l.status}${l.company ? `${sep}${l.company}` : ""})`).join(sep) || none}
**${L.pipeline}:** ${L.openValue}: ${money(snapshot.sales.pipelineValueOpen, lang)} (${snapshot.sales.totalDealsOpen} ${L.deals})${sep}${L.winRate}: ${snapshot.sales.winRate !== null ? `${snapshot.sales.winRate}%` : L.noData}${snapshot.sales.staleDeals.length ? `${sep}${L.stale}: ${snapshot.sales.staleDeals.map((d) => `${sanitizeFreeText(d.title)} (${d.daysSinceUpdate} ${L.days})`).join(sep)}` : ""}

**${L.perf}:** ${L.revenue}: ${money(snapshot.data.revenueLast30d, lang)}${sep}${L.events}: ${snapshot.data.usageEventsLast30d}${sep}${L.issues}: ${snapshot.data.platformProviderIssuesLast30d}${snapshot.data.providerFailureBreakdown.length ? ` (${L.breakdown}: ${snapshot.data.providerFailureBreakdown.map((p) => `${p.provider}: ${p.failures} ${L.times}`).join(sep)})` : ""}

${memoryLines || lessonLines ? `${MIXED_LANGUAGE_NOTE[lang]}\n` : ""}${memoryLines ? `**${L.mem}:**\n${memoryLines}\n` : ""}
${lessonLines ? `**${L.lessons}:**\n${lessonLines}\n` : ""}
${marketResearch ? `**${L.market}:**\n${marketResearch}` : ""}`;
}

const MARKET_QUERY: Record<Lang, (industry: string, name: string) => string> = {
  fa: (industry, name) => `رقبا و روند بازار ${industry} در ایران ${name ? `شبیه ${name}` : ""}`,
  en: (industry, name) => `competitors and market trends in ${industry}${name ? ` similar to ${name}` : ""}`,
  de: (industry, name) => `Wettbewerber und Markttrends in ${industry}${name ? ` ähnlich wie ${name}` : ""}`,
};

/**
 * Runs one CEO analysis pass for a user: builds the real-data snapshot, optionally runs a live
 * market/competitor search (if Tavily is configured and the user has a business profile), streams
 * the AI's prioritization in `lang`, and persists any new "lessons for future memory" it writes.
 * Shared by the on-demand API route and the autonomous daily cron job.
 */
export async function runCeoAnalysis(userId: string, lang: Lang, onChunk: (text: string) => void): Promise<string> {
  const snapshot = await buildBusinessSnapshot(userId);

  let marketResearch: string | null = null;
  if (hasTavily && snapshot.businessDoctor.latest) {
    const { businessName, industry } = snapshot.businessDoctor.latest;
    const results = await searchWeb(MARKET_QUERY[lang](industry, businessName || ""));
    if (results) marketResearch = formatSearchResultsForPrompt(results);
  }

  const prompt = buildCeoPrompt(snapshot, marketResearch, lang);

  let fullOutput = "";
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    systemPrompt(lang),
    (text) => { fullOutput += text; onChunk(text); },
    () => {},
    undefined,
    undefined,
    4096
  );

  await persistMemories(userId, fullOutput);
  return fullOutput;
}

async function persistMemories(userId: string, fullOutput: string): Promise<void> {
  for (const { category, text } of extractMemoryLines(fullOutput)) {
    const embedding = await embedForStorage(text);
    await prisma.businessMemory.create({ data: { userId, category, text, source: "ceo", embedding } });
  }
}

