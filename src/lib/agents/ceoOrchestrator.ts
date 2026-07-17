import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildBusinessSnapshot, BusinessSnapshot } from "@/lib/agents/businessSnapshot";
import { hasTavily, searchWeb, formatSearchResultsForPrompt } from "@/lib/search/tavily";
import { embedForStorage } from "@/lib/rag/retrieve";

const SYSTEM = `تو "مدیرعامل" (CEO) یک سیستم چندعامله (multi-agent) هستی که وضعیت واقعی کسب‌وکار کاربر را از چند ابزار مختلف (دکتر کسب‌وکار، تولید محتوا، شبکه‌های اجتماعی، CRM فروش، آمار مصرف و درآمد، پایداری سرویس پلتفرم، و در صورت وجود، جستجوی زندهٔ وب برای بازار و رقبا) دریافت می‌کنی.
وظیفهٔ تو: بر اساس این داده‌های واقعی و حافظهٔ مشترک تجمیع‌شده از تحلیل‌های قبلی، مشخص کن الان چه چیزی بیشترین نیاز به توجه دارد و چه تصمیماتی باید گرفته شود.
اگر داده‌ای برای یک بخش موجود نیست، آن را نادیده بگیر — هرگز داده یا آماری که در ورودی نیامده را نساز.
اگر نتایج جستجوی وب دربارهٔ بازار/رقبا داده شده، آن‌ها را در یه بخش «تحلیل بازار و رقبا» جداگانه در همون خروجی خلاصه کن و به منابع اشاره کن.

خروجی را دقیقاً با این ساختار Markdown بده:
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
- ...

## نکاتی برای حافظهٔ آینده
(۲ تا ۴ نکتهٔ کوتاه و عملی که باید در تحلیل‌های بعدی به یاد داشته باشی — هر نکته در یک خط، با پیشوند دسته‌بندی به این شکل دقیق: [sales]، [content]، [seo]، [social]، [dev]، یا [general])`;

function buildCeoPrompt(snapshot: BusinessSnapshot, marketResearch: string | null): string {
  const memoryLines = (snapshot.memories || []).map((m) => `[${m.category}] ${m.text}`).join("\n");

  return `داده‌های واقعی فعلی کسب‌وکار:

**دکتر کسب‌وکار:** ${snapshot.businessDoctor.totalAnalyses} تحلیل ثبت‌شده${snapshot.businessDoctor.latest ? `، آخرین مورد: ${snapshot.businessDoctor.latest.businessName} (${snapshot.businessDoctor.latest.industry})` : ""}

**محتوا:** ${snapshot.content.totalPosts} مقاله منتشرشده. عناوین اخیر: ${snapshot.content.latest.map((p) => p.title).join("، ") || "هیچ‌کدام"}

**شبکه‌های اجتماعی:** ${snapshot.social.totalPosts} پست تولیدشده. موضوعات اخیر: ${snapshot.social.latest.map((s) => s.topic).join("، ") || "هیچ‌کدام"}

**فروش (CRM):** ${snapshot.sales.totalContacts} مخاطب ثبت‌شده، ${snapshot.sales.needingFollowUp.length} مورد نیاز به پیگیری: ${snapshot.sales.needingFollowUp.map((l) => `${l.name} (${l.status}${l.company ? `، ${l.company}` : ""})`).join("، ") || "هیچ‌کدام"}

**دیتا و عملکرد (۳۰ روز اخیر):** درآمد موفق: ${snapshot.data.revenueLast30d.toLocaleString("fa-IR")} تومان، تعداد فعالیت ثبت‌شده: ${snapshot.data.usageEventsLast30d}، تعداد قطعی/افت سرویس AI پلتفرم: ${snapshot.data.platformProviderIssuesLast30d}${snapshot.data.providerFailureBreakdown.length ? ` (تفکیک: ${snapshot.data.providerFailureBreakdown.map((p) => `${p.provider}: ${p.failures} بار`).join("، ")})` : ""}

${memoryLines ? `**حافظهٔ مشترک از تحلیل‌های قبلی:**\n${memoryLines}` : ""}

${marketResearch ? `**نتایج جستجوی زندهٔ وب دربارهٔ بازار و رقبا:**\n${marketResearch}` : ""}`;
}

/** Runs one CEO analysis pass for a user: builds the real-data snapshot, optionally runs a live market/competitor search (if Tavily is configured and the user has a business profile), streams the AI's prioritization, and persists any new "lessons for future memory" it writes. Shared by the on-demand API route and the autonomous daily cron job. */
export async function runCeoAnalysis(userId: string, onChunk: (text: string) => void): Promise<string> {
  const snapshot = await buildBusinessSnapshot(userId);

  let marketResearch: string | null = null;
  if (hasTavily && snapshot.businessDoctor.latest) {
    const { businessName, industry } = snapshot.businessDoctor.latest;
    const results = await searchWeb(`رقبا و روند بازار ${industry} در ایران ${businessName ? `شبیه ${businessName}` : ""}`);
    if (results) marketResearch = formatSearchResultsForPrompt(results);
  }

  const prompt = buildCeoPrompt(snapshot, marketResearch);

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
  const memLines = memSection.split("\n").map((l) => l.trim()).filter((l) => /^\[(sales|content|seo|social|dev|general)\]/.test(l));
  for (const line of memLines) {
    const m = /^\[(\w+)\]\s*(.+)/.exec(line);
    if (m) {
      const embedding = await embedForStorage(m[2].trim());
      await prisma.businessMemory.create({ data: { userId, category: m[1], text: m[2].trim(), source: "ceo", embedding } });
    }
  }

  return fullOutput;
}
