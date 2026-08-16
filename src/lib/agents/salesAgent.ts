import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildCrmSnapshot, CrmSnapshot } from "@/lib/agents/crmSnapshot";
import { embedForStorage } from "@/lib/rag/retrieve";
import { wrapUntrustedContent, looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import type { Lang } from "@/lib/i18n/server";

function sanitizeFreeText(text: string): string {
  return looksLikeInjectionAttempt(text) ? "[invalid content removed]" : text;
}

// German has no dedicated sales prompt yet — fall back to English, same
// convention used by the CEO/Meeting routes for the de.ts placeholder locale.
function promptLang(l: Lang): "fa" | "en" {
  return l === "fa" ? "fa" : "en";
}

const SECTION_HEADERS = {
  fa: {
    forecast: "۱. پیش‌بینی فروش",
    atRisk: "۲. معاملات در خطر",
    objections: "۳. راهنمای مقابله با اعتراض‌ها",
    battlecard: "۴. Battlecard رقابتی",
    coaching: "۵. کوچینگ فروش",
    actions: "۶. Action Items",
    memory: "نکاتی برای حافظهٔ آینده",
  },
  en: {
    forecast: "1. Sales Forecast",
    atRisk: "2. At-Risk Deals",
    objections: "3. Objection-Handling Guide",
    battlecard: "4. Competitive Battlecard",
    coaching: "5. Sales Coaching",
    actions: "6. Action Items",
    memory: "Notes for future memory",
  },
} as const;

function buildSystem(lang: "fa" | "en", industry: string | null) {
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
1. [priority: high/medium/low] ...
2. ...
3. ...

## ${h.memory}
(2-4 short, actionable notes to remember for future Sales Agent runs — one per line, each prefixed exactly with [pipeline], [lead_source], [risk], or [general])`;
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
۱. [اولویت: بالا/متوسط/پایین] ...
۲. ...
۳. ...

## ${h.memory}
(۲ تا ۴ نکتهٔ کوتاه و عملی که باید در اجراهای بعدی ایجنت فروش به یاد داشته باشی — هر نکته در یک خط، با پیشوند دقیقاً به این شکل: [pipeline]، [lead_source]، [risk]، یا [general])`;
}

function buildPrompt(snapshot: CrmSnapshot, industry: string | null, lang: "fa" | "en", memories: { category: string; text: string }[]): string {
  const memoryLines = memories.map((m) => `[${m.category}] ${m.text}`).join("\n");

  if (lang === "en") {
    const staleLines = snapshot.staleDeals
      .map((d) => `- ${sanitizeFreeText(d.title)} (contact: ${sanitizeFreeText(d.contactName)}, ${d.daysSinceUpdate} days inactive, value: ${d.value.toLocaleString("en-US")})`)
      .join("\n") || "No stale deals";
    const sourceLines = snapshot.leadSources
      .map((s) => `- ${s.source}: ${s.total} contacts, ${s.conversionRate}% converted to customer`)
      .join("\n") || "No data available";

    return `Real sales pipeline data:

**Open pipeline value:** $${snapshot.pipelineValueOpen.toLocaleString("en-US")} (${snapshot.totalDealsOpen} open deals)
**Win rate (last 90 days):** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "No data available"}
**Average sales cycle:** ${snapshot.avgSalesCycleDays !== null ? `${snapshot.avgSalesCycleDays} days` : "No data available"}
**Total contacts:** ${snapshot.totalContacts}

**Stale deals (no activity for 7+ days):**
${wrapUntrustedContent("Deal title and contact name — entered by the user or a lead", staleLines)}

**Lead sources and conversion rate:**
${sourceLines}

${memoryLines ? `**Shared memory from previous Sales Agent runs:**\n${memoryLines}` : ""}`;
  }

  const staleLines = snapshot.staleDeals
    .map((d) => `- ${sanitizeFreeText(d.title)} (مخاطب: ${sanitizeFreeText(d.contactName)}, ${d.daysSinceUpdate} روز بدون فعالیت, ارزش: ${d.value.toLocaleString("fa-IR")})`)
    .join("\n") || "هیچ معاملهٔ راکدی نیست";
  const sourceLines = snapshot.leadSources
    .map((s) => `- ${s.source}: ${s.total} مخاطب، ${s.conversionRate}% تبدیل به مشتری`)
    .join("\n") || "داده‌ای موجود نیست";

  return `داده‌های واقعی Pipeline فروش:

**ارزش Pipeline باز:** ${snapshot.pipelineValueOpen.toLocaleString("fa-IR")} (${snapshot.totalDealsOpen} معاملهٔ باز)
**نرخ برد (۹۰ روز اخیر):** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "داده‌ای موجود نیست"}
**میانگین زمان بستن معامله:** ${snapshot.avgSalesCycleDays !== null ? `${snapshot.avgSalesCycleDays} روز` : "داده‌ای موجود نیست"}
**تعداد کل مخاطبین:** ${snapshot.totalContacts}

**معاملات راکد (بدون فعالیت ۷+ روز):**
${wrapUntrustedContent("عنوان معامله و نام مخاطب — وارد‌شده توسط کاربر یا لید", staleLines)}

**منابع لید و نرخ تبدیل:**
${sourceLines}

${memoryLines ? `**حافظهٔ مشترک از اجراهای قبلی ایجنت فروش:**\n${memoryLines}` : ""}`;
}

/** Runs one Sales Agent analysis pass: forecast, at-risk deals, objection handling, competitive battlecard, coaching, and action items — built from the same CRM snapshot as crmAgent, but sales-manager framed and bilingual. Persists memory/tasks the same way runCrmAnalysis does. */
export async function runSalesAnalysis(userId: string, lang: Lang, onChunk: (text: string) => void): Promise<string> {
  const effectiveLang = promptLang(lang);
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

  const prompt = buildPrompt(snapshot, company?.industry || null, effectiveLang, priorInsights);
  const system = buildSystem(effectiveLang, company?.industry || null);

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

  const h = SECTION_HEADERS[effectiveLang];
  const memRegex = new RegExp(`## ${h.memory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([\\s\\S]*)`);
  const memSection = memRegex.exec(fullOutput)?.[1] || "";
  const memLines = memSection.split("\n").map((l) => l.trim()).filter((l) => /^\[(pipeline|lead_source|risk|general)\]/.test(l));
  for (const line of memLines) {
    const m = /^\[(\w+)\]\s*(.+)/.exec(line);
    if (m) {
      const embedding = await embedForStorage(m[2].trim());
      await prisma.crmInsight.create({ data: { userId, category: "sales", text: m[2].trim(), embedding } });
    }
  }

  const actionRegex = new RegExp(`## ${h.actions.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([\\s\\S]*?)(?=\\n## |$)`);
  const actionSection = actionRegex.exec(fullOutput)?.[1] || "";
  const priorityWord = effectiveLang === "en" ? "high" : "بالا";
  const highPriorityLines = actionSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => new RegExp(`^[\\d۰-۹]*\\.\\s*\\[(priority:|اولویت:)\\s*${priorityWord}\\]`, "i").test(l));
  for (const line of highPriorityLines) {
    const title = line.replace(/^[\d۰-۹]*\.\s*\[(priority:|اولویت:)\s*\S+\]\s*/i, "").trim();
    if (!title) continue;
    const alreadyExists = await prisma.crmTask.findFirst({ where: { userId, title, status: "pending" } });
    if (alreadyExists) continue;
    await prisma.crmTask.create({ data: { userId, title, autoGenerated: true } });
  }

  return fullOutput;
}
