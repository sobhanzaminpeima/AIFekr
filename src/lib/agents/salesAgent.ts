import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildCrmSnapshot, CrmSnapshot } from "@/lib/agents/crmSnapshot";
import { embedForStorage } from "@/lib/rag/retrieve";
import { wrapUntrustedContent, looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { MEMORY_MARKER, extractMemoryLines, SALES_MEMORY_CATEGORIES } from "@/lib/agents/ceoMemoryFormat";

function sanitizeFreeText(text: string): string {
  return looksLikeInjectionAttempt(text) ? "[invalid content removed]" : text;
}

const SECTION_HEADERS: Record<Lang, Record<"forecast"|"atRisk"|"objections"|"battlecard"|"coaching"|"actions", string>> = {
  fa: {
    forecast: "۱. پیش‌بینی فروش",
    atRisk: "۲. معاملات در خطر",
    objections: "۳. راهنمای مقابله با اعتراض‌ها",
    battlecard: "۴. Battlecard رقابتی",
    coaching: "۵. کوچینگ فروش",
    actions: "۶. Action Items",
  },
  en: {
    forecast: "1. Sales Forecast",
    atRisk: "2. At-Risk Deals",
    objections: "3. Objection-Handling Guide",
    battlecard: "4. Competitive Battlecard",
    coaching: "5. Sales Coaching",
    actions: "6. Action Items",
  },
  de: {
    forecast: "1. Umsatzprognose",
    atRisk: "2. Gefährdete Deals",
    objections: "3. Leitfaden zur Einwandbehandlung",
    battlecard: "4. Wettbewerbs-Battlecard",
    coaching: "5. Vertriebs-Coaching",
    actions: "6. Action Items",
  },
};

function buildSystem(lang: Lang, industry: string | null) {
  const h = SECTION_HEADERS[lang];
  if (lang === "en") {
    return `You are a senior Sales Manager with 15 years of experience, reviewing a business's real CRM pipeline data.
The data you receive is pre-computed and accurate (pipeline value, win rate, stale deals, best lead source) — never invent a number that wasn't given to you.
If data for a section is missing or empty, say briefly "no data available" or omit that part.
Write the entire output in fluent English only.
${industry ? `The business's industry is: ${industry} — tailor objection handling and the battlecard to this industry.` : ""}

Respond in exactly this Markdown structure:
## ${h.forecast}
(Estimate this month's/quarter's likely closed revenue from open pipeline value, win rate, and average sales cycle. State your confidence level.)

## ${h.atRisk}
(For each important stale deal, suggest one specific, short next action.)

## ${h.objections}
(List the 3-5 most common objections a buyer in this industry raises, each with a short, ready-to-use rebuttal.)

## ${h.battlecard}
(Based on the industry, list likely competitor angles and how this business should position against them. If no competitor info was given, give general industry-standard positioning advice.)

## ${h.coaching}
(2-3 concrete coaching tips to improve this pipeline's conversion rate.)

## ${h.actions}
1. [priority: high] ...
2. [priority: medium] ...
3. [priority: low] ...
Write the "[priority: ...]" tag in English exactly like that, with high/medium/low, even though the rest of the line is prose. It is read by software.

${MEMORY_MARKER}
(2-4 short, actionable notes to remember for future Sales Agent runs — one per line, each prefixed exactly with [pipeline], [lead_source], [risk], or [general])
Emit the ${MEMORY_MARKER} line verbatim; do not translate it.`;
  }

  if (lang === "de") {
    return `Du bist eine Vertriebsleiterin mit 15 Jahren Erfahrung und prüfst die reale CRM-Pipeline eines Unternehmens.
Die Daten, die du erhältst, sind vorberechnet und korrekt (Pipeline-Wert, Gewinnrate, liegengebliebene Deals, beste Lead-Quelle) — erfinde niemals eine Zahl, die nicht in der Eingabe stand.
Fehlen Daten zu einem Abschnitt oder sind sie leer, schreibe kurz „keine Daten verfügbar" oder lasse den Teil weg.
Schreibe die gesamte Ausgabe in flüssigem Deutsch.
Beträge tragen die Währung, in der sie übergeben wurden — wechsle sie nie und erfinde keinen Umrechnungskurs.
${industry ? `Die Branche des Unternehmens ist: ${industry} — richte Einwandbehandlung und Battlecard auf diese Branche aus.` : ""}

Antworte exakt in dieser Markdown-Struktur:
## ${h.forecast}
(Schätze aus offenem Pipeline-Wert, Gewinnrate und durchschnittlicher Verkaufsdauer den wahrscheinlich abgeschlossenen Umsatz dieses Monats/Quartals. Nenne dein Konfidenzniveau.)

## ${h.atRisk}
(Schlage für jeden wichtigen liegengebliebenen Deal eine konkrete, kurze nächste Aktion vor.)

## ${h.objections}
(Nenne die 3-5 häufigsten Einwände von Käuferinnen und Käufern in dieser Branche, jeweils mit einer kurzen, direkt verwendbaren Entgegnung.)

## ${h.battlecard}
(Nenne auf Basis der Branche wahrscheinliche Argumentationslinien der Wettbewerber und wie sich dieses Unternehmen dagegen positionieren sollte. Liegen keine Wettbewerbsinfos vor, gib allgemeine branchenübliche Positionierungshinweise.)

## ${h.coaching}
(2-3 konkrete Coaching-Hinweise, um die Abschlussquote dieser Pipeline zu verbessern.)

## ${h.actions}
1. [priority: high] ...
2. [priority: medium] ...
3. [priority: low] ...
Schreibe den Marker „[priority: ...]" exakt so auf Englisch mit high/medium/low, auch wenn der Rest der Zeile Deutsch ist. Er wird von Software ausgelesen.

${MEMORY_MARKER}
(2-4 kurze, umsetzbare Notizen für künftige Läufe des Vertriebs-Agenten — je eine pro Zeile, jeweils exakt mit [pipeline], [lead_source], [risk] oder [general] vorangestellt)
Gib die Zeile ${MEMORY_MARKER} wortwörtlich aus; übersetze sie nicht.`;
  }

  return `تو یک مدیر فروش ارشد با ۱۵ سال تجربه هستی که Pipeline فروش واقعی یک کسب‌وکار را بررسی می‌کنی.
داده‌هایی که دریافت می‌کنی از قبل محاسبه‌شده و دقیق هستند (ارزش Pipeline، نرخ برد، معاملات راکد، بهترین منبع لید) — هرگز عددی نساز که در ورودی نیامده.
اگر داده‌ای برای یک بخش موجود نیست یا خالی است، آن بخش را کوتاه بگو "داده‌ای موجود نیست" یا کلاً حذفش کن.
کل خروجی را کاملاً و فقط به فارسی روان بنویس.
${industry ? `صنعت این کسب‌وکار: ${industry} — راهنمای اعتراض‌ها و Battlecard را متناسب با این صنعت بنویس.` : ""}

خروجی را دقیقاً با این ساختار Markdown بده:
## ${h.forecast}
(بر اساس ارزش Pipeline باز، نرخ برد و میانگین زمان بستن معامله، درآمد محتمل این ماه/فصل را تخمین بزن و سطح اطمینانت را بگو)

## ${h.atRisk}
(برای هر معاملهٔ راکد مهم، یک اقدام مشخص و کوتاه پیشنهاد بده)

## ${h.objections}
(۳ تا ۵ اعتراض رایج مشتریان این صنعت را همراه با پاسخ کوتاه و آماده برای هرکدام بنویس)

## ${h.battlecard}
(بر اساس صنعت، زاویه‌های احتمالی رقبا و نحوهٔ جایگاه‌یابی این کسب‌وکار در برابرشان را بنویس. اگر اطلاعات رقیب داده نشده، توصیه‌های عمومی و استاندارد صنعت را بده)

## ${h.coaching}
(۲ تا ۳ نکتهٔ عملی برای بهبود نرخ تبدیل این Pipeline)

## ${h.actions}
۱. [priority: high] ...
۲. [priority: medium] ...
۳. [priority: low] ...
برچسب «[priority: ...]» را عیناً به همین شکل انگلیسی با high/medium/low بنویس، حتی اگر بقیهٔ خط فارسی است. این برچسب را نرم‌افزار می‌خواند.

${MEMORY_MARKER}
(۲ تا ۴ نکتهٔ کوتاه و عملی که باید در اجراهای بعدی ایجنت فروش به یاد داشته باشی — هر نکته در یک خط، با پیشوند دقیقاً به این شکل: [pipeline]، [lead_source]، [risk]، یا [general])
خطِ ${MEMORY_MARKER} را عیناً و بدون تغییر بنویس؛ ترجمه‌اش نکن.`;
}

function buildPrompt(snapshot: CrmSnapshot, industry: string | null, lang: Lang, memories: { category: string; text: string }[]): string {
  const memoryLines = memories.map((m) => `[${m.category}] ${m.text}`).join("\n");
  const numLocale = tri(lang, "fa-IR", "en-US", "de-DE");
  const noData = tri(lang, "داده‌ای موجود نیست", "No data available", "Keine Daten verfügbar");

  const L = tri(lang,
    { header: "داده‌های واقعی Pipeline فروش", open: "ارزش Pipeline باز", deals: "معاملهٔ باز", win: "نرخ برد (۹۰ روز اخیر)", cycle: "میانگین زمان بستن معامله", days: "روز", contacts: "تعداد کل مخاطبین", staleH: "معاملات راکد (بدون فعالیت ۷+ روز)", sourcesH: "منابع لید و نرخ تبدیل", memH: "حافظهٔ مشترک از اجراهای قبلی ایجنت فروش", contact: "مخاطب", inactive: "روز بدون فعالیت", value: "ارزش", noStale: "هیچ معاملهٔ راکدی نیست", contactsWord: "مخاطب", converted: "تبدیل به مشتری", untrusted: "عنوان معامله و نام مخاطب — وارد‌شده توسط کاربر یا لید" },
    { header: "Real sales pipeline data", open: "Open pipeline value", deals: "open deals", win: "Win rate (last 90 days)", cycle: "Average sales cycle", days: "days", contacts: "Total contacts", staleH: "Stale deals (no activity for 7+ days)", sourcesH: "Lead sources and conversion rate", memH: "Shared memory from previous Sales Agent runs", contact: "contact", inactive: "days inactive", value: "value", noStale: "No stale deals", contactsWord: "contacts", converted: "converted to customer", untrusted: "Deal title and contact name — entered by the user or a lead" },
    { header: "Reale Vertriebs-Pipeline-Daten", open: "Offener Pipeline-Wert", deals: "offene Deals", win: "Gewinnrate (letzte 90 Tage)", cycle: "Durchschnittliche Verkaufsdauer", days: "Tage", contacts: "Kontakte gesamt", staleH: "Liegengebliebene Deals (7+ Tage ohne Aktivität)", sourcesH: "Lead-Quellen und Conversion-Rate", memH: "Gemeinsames Gedächtnis früherer Läufe des Vertriebs-Agenten", contact: "Kontakt", inactive: "Tage ohne Aktivität", value: "Wert", noStale: "Keine liegengebliebenen Deals", contactsWord: "Kontakte", converted: "zu Kunden konvertiert", untrusted: "Deal-Titel und Kontaktname — von Nutzer oder Lead eingegeben" });

  const staleLines = snapshot.staleDeals
    .map((d) => `- ${sanitizeFreeText(d.title)} (${L.contact}: ${sanitizeFreeText(d.contactName)}, ${d.daysSinceUpdate} ${L.inactive}, ${L.value}: ${d.value.toLocaleString(numLocale)})`)
    .join("\n") || L.noStale;
  const sourceLines = snapshot.leadSources
    .map((s) => `- ${s.source}: ${s.total} ${L.contactsWord}, ${s.conversionRate}% ${L.converted}`)
    .join("\n") || noData;

  // No currency symbol. The English branch used to print a literal "$" and the
  // Persian one a bare fa-IR number: pipelineValueOpen and each deal value are
  // sums over deals priced in whatever currency each was created with, so any
  // single symbol is a claim the data does not support.
  const unitNote = tri(lang,
    "(واحد پولی این ارقام مشخص نیست — هیچ واحدی به آن‌ها نسبت نده)",
    "(the currency of these figures is unspecified — do not attach a unit to them)",
    "(die Währung dieser Zahlen ist nicht spezifiziert — ordne ihnen keine Einheit zu)");

  return `${L.header}:

**${L.open}:** ${snapshot.pipelineValueOpen.toLocaleString(numLocale)} ${unitNote} (${snapshot.totalDealsOpen} ${L.deals})
**${L.win}:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : noData}
**${L.cycle}:** ${snapshot.avgSalesCycleDays !== null ? `${snapshot.avgSalesCycleDays} ${L.days}` : noData}
**${L.contacts}:** ${snapshot.totalContacts}

**${L.staleH}:**
${wrapUntrustedContent(L.untrusted, staleLines)}

**${L.sourcesH}:**
${sourceLines}

${memoryLines ? `**${L.memH}:**\n${memoryLines}` : ""}`;
}

/** Runs one Sales Agent analysis pass: forecast, at-risk deals, objection handling, competitive battlecard, coaching, and action items — built from the same CRM snapshot as crmAgent, but sales-manager framed and bilingual. Persists memory/tasks the same way runCrmAnalysis does. */
export async function runSalesAnalysis(userId: string, lang: Lang, onChunk: (text: string) => void): Promise<string> {
  const [snapshot, company, priorInsights] = await Promise.all([
    buildCrmSnapshot(userId),
    prisma.company.findUnique({ where: { userId }, select: { industry: true } }),
    prisma.crmInsight.findMany({
      where: { userId, category: "sales" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { category: true, text: true },
    }),
  ]);

  const prompt = buildPrompt(snapshot, company?.industry || null, lang, priorInsights);
  const system = buildSystem(lang, company?.industry || null);

  let fullOutput = "";
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    system,
    (text) => { fullOutput += text; onChunk(text); },
    () => {},
    undefined,
    undefined,
    4096
  );

  // Both parsers below used to key on the *translated* section heading and, for
  // priority, on a translated word ("high" / "بالا"). That works for two hand-
  // maintained languages and fails silently the moment a third is added: no
  // error, just an agent that quietly stops recording memory and stops creating
  // tasks. Both now key on untranslated machine tokens the prompt pins down.
  for (const { text } of extractMemoryLines(fullOutput, SALES_MEMORY_CATEGORIES)) {
    const embedding = await embedForStorage(text);
    await prisma.crmInsight.create({ data: { userId, category: "sales", text, embedding } });
  }

  const h = SECTION_HEADERS[lang];
  const actionRegex = new RegExp(`## ${h.actions.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([\\s\\S]*?)(?=\\n## |$)`);
  const actionSection = actionRegex.exec(fullOutput)?.[1] || "";
  const highPriorityLines = actionSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[\d۰-۹]*\.\s*\[priority:\s*high\]/i.test(l));
  for (const line of highPriorityLines) {
    const title = line.replace(/^[\d۰-۹]*\.\s*\[priority:\s*\S+\]\s*/i, "").trim();
    if (!title) continue;
    const alreadyExists = await prisma.crmTask.findFirst({ where: { userId, title, status: "pending" } });
    if (alreadyExists) continue;
    await prisma.crmTask.create({ data: { userId, title, autoGenerated: true } });
  }

  return fullOutput;
}
