import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildCrmSnapshot, CrmSnapshot } from "@/lib/agents/crmSnapshot";
import { embedForStorage } from "@/lib/rag/retrieve";
import { wrapUntrustedContent, looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";

// Deal titles and contact names are free text entered by the user or a lead
// (e.g. via an Instagram DM auto-converted to a contact) — unlike the rest of
// this snapshot, which is server-computed, these two fields reach the prompt
// verbatim. Neutralize anything that looks like an injection attempt before
// it's interpolated into the per-deal line.
export function sanitizeFreeText(text: string): string {
  return looksLikeInjectionAttempt(text) ? "[محتوای نامعتبر حذف شد]" : text;
}

const SYSTEM = `تو یک تحلیل‌گر ارشد فروش و رشد با ۱۵ سال تجربه هستی که Pipeline فروش CRM یک کسب‌وکار را بررسی می‌کنی.
داده‌هایی که دریافت می‌کنی از قبل محاسبه‌شده و دقیق هستند (Pipeline Value، نرخ برد، معاملات راکد، بهترین منبع لید) — هرگز عددی نساز که در ورودی نیامده.
اگر داده‌ای برای یک بخش موجود نیست یا خالی است، آن بخش را کوتاه بگو "داده‌ای موجود نیست" یا کلاً حذفش کن.
کل خروجی را کاملاً و فقط به فارسی روان بنویس — هرگز کلمه یا کاراکتر از زبان‌های دیگر (ویتنامی، چینی، کره‌ای، تایلندی، هندی و غیره) قاطی متن نکن.

خروجی را دقیقاً با این ساختار Markdown بده:
## ۱. وضعیت کلی Pipeline
(۲ تا ۳ جمله دربارهٔ ارزش Pipeline باز، نرخ برد، و میانگین زمان بستن معامله)

## ۲. معاملات در خطر و اقدام پیشنهادی
(برای هر معاملهٔ راکد مهم، یک اقدام مشخص و کوتاه پیشنهاد بده)

## ۳. فرصت‌های رشد
(بر اساس بهترین منبع لید و نرخ تبدیل هر منبع، ۱ تا ۳ فرصت مشخص)

## ۴. Action Items
۱. [اولویت: بالا/متوسط/پایین] ...
۲. ...
۳. ...

## نکاتی برای حافظهٔ آینده
(۲ تا ۴ نکتهٔ کوتاه و عملی که باید در تحلیل‌های بعدی CRM به یاد داشته باشی — هر نکته در یک خط، با پیشوند دسته‌بندی دقیقاً به این شکل: [pipeline]، [lead_source]، [risk]، یا [general])`;

function buildCrmPrompt(snapshot: CrmSnapshot, insightMemories: { category: string; text: string }[]): string {
  const memoryLines = insightMemories.map((m) => `[${m.category}] ${m.text}`).join("\n");

  const staleLines = snapshot.staleDeals
    .map((d) => `- ${sanitizeFreeText(d.title)} (مخاطب: ${sanitizeFreeText(d.contactName)}, ${d.daysSinceUpdate} روز بدون فعالیت, ارزش: ${d.value.toLocaleString("fa-IR")})`)
    .join("\n") || "هیچ معاملهٔ راکدی نیست";

  const sourceLines = snapshot.leadSources
    .map((s) => `- ${s.source}: ${s.total} مخاطب، ${s.conversionRate}% تبدیل به مشتری`)
    .join("\n") || "داده‌ای موجود نیست";

  return `داده‌های واقعی Pipeline فروش:

**Pipeline Value باز:** ${snapshot.pipelineValueOpen.toLocaleString("fa-IR")} (${snapshot.totalDealsOpen} معاملهٔ باز)
**نرخ برد (۹۰ روز اخیر):** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "داده‌ای موجود نیست"}
**میانگین زمان بستن معامله:** ${snapshot.avgSalesCycleDays !== null ? `${snapshot.avgSalesCycleDays} روز` : "داده‌ای موجود نیست"}
**تعداد کل مخاطبین:** ${snapshot.totalContacts}

**معاملات راکد (بدون فعالیت ۷+ روز):**
${wrapUntrustedContent("عنوان معامله و نام مخاطب — وارد‌شده توسط کاربر یا لید", staleLines)}

**منابع لید و نرخ تبدیل:**
${sourceLines}

${memoryLines ? `**حافظهٔ مشترک از تحلیل‌های قبلی CRM:**\n${memoryLines}` : ""}`;
}

/** Runs one CRM analysis pass for a user: builds the pre-computed metrics snapshot, streams the AI's read on it, persists "future memory" notes as embedded CrmInsight rows, and auto-creates CrmTask rows for high-priority action items. Mirrors runCeoAnalysis's structure. */
export async function runCrmAnalysis(userId: string, onChunk: (text: string) => void): Promise<string> {
  const snapshot = await buildCrmSnapshot(userId);

  const priorInsights = await prisma.crmInsight.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { category: true, text: true },
  });

  const prompt = buildCrmPrompt(snapshot, priorInsights);

  let fullOutput = "";
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    SYSTEM,
    (text) => { fullOutput += text; onChunk(text); },
    () => {},
    undefined,
    undefined,
    4096
  );

  const memSection = /## نکاتی برای حافظهٔ آینده\s*([\s\S]*)/.exec(fullOutput)?.[1] || "";
  const memLines = memSection.split("\n").map((l) => l.trim()).filter((l) => /^\[(pipeline|lead_source|risk|general)\]/.test(l));
  for (const line of memLines) {
    const m = /^\[(\w+)\]\s*(.+)/.exec(line);
    if (m) {
      const embedding = await embedForStorage(m[2].trim());
      await prisma.crmInsight.create({ data: { userId, category: m[1], text: m[2].trim(), embedding } });
    }
  }

  const actionSection = /## ۴\. Action Items\s*([\s\S]*?)(?=\n## |$)/.exec(fullOutput)?.[1] || "";
  // The model numbers this list with Persian digits (۱. ۲. ۳.), not ASCII, so strip
  // any leading numeral/dot rather than matching digits.
  const highPriorityLines = actionSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[\d۰-۹]*\.\s*\[اولویت:\s*بالا\]/.test(l));
  for (const line of highPriorityLines) {
    const title = line.replace(/^[\d۰-۹]*\.\s*\[اولویت:\s*بالا\]\s*/, "").trim();
    if (!title) continue;
    const alreadyExists = await prisma.crmTask.findFirst({ where: { userId, title, status: "pending" } });
    if (alreadyExists) continue;
    await prisma.crmTask.create({ data: { userId, title, autoGenerated: true } });
  }

  return fullOutput;
}
