import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildCrmSnapshot } from "@/lib/agents/crmSnapshot";
import { listFeedbackNeeded } from "@/lib/agents/viewingCoordinator";
import type { Lang } from "@/lib/i18n/server";

/**
 * Section 2, item 6 — Agency Manager Assistant. Reuses the existing
 * buildCrmSnapshot() (generic pipeline metrics) and listFeedbackNeeded()
 * (item 3's feedback nudge) rather than recomputing anything — this agent
 * is a real-estate-flavored lens on data that already exists, not a new
 * data source.
 *
 * Explicit spec requirement, stricter than the generic crmAgent.ts this
 * mirrors: purely reportive/suggestive, must proactively ask questions
 * about specific stale items rather than dump a raw report, and — unlike
 * crmAgent.ts — never auto-creates CrmTask rows or writes anything. Every
 * output is read-only text a human reviews.
 */

function promptLang(l: Lang): "fa" | "en" {
  return l === "fa" ? "fa" : "en";
}

const SYSTEM = {
  fa: `تو "دستیار مدیر آژانس املاک" هستی. یک خلاصهٔ دوره‌ای از وضعیت Pipeline و بازدیدهای این آژانس به تو داده می‌شود.
وظیفهٔ تو نوشتن یک گزارش کوتاه و **سوال‌محور** است — هرگز فقط داده خام را تکرار نکن.
برای هر مورد مهم (مثلاً لیدهای رهاشده یا بازدیدهای بدون بازخورد)، دقیقاً مثل یک همکار مطمئن، یک سوال مشخص از مدیر بپرس (مثلاً: «این ۳ لید ۱۰ روز است بی‌پاسخ مانده‌اند — پیگیری برایشان زمان‌بندی کنم؟»).
تو هرگز نباید خودت اقدامی روی داده یا مشتری انجام دهی — فقط پیشنهاد و سوال بده، تصمیم نهایی همیشه با مدیر آژانس است.
کل خروجی را فقط به فارسی روان بنویس.
خروجی را دقیقاً با این ساختار Markdown بده:
## خلاصهٔ Pipeline
(۲-۳ جمله)

## لیدهای نیازمند پیگیری
(برای هر مورد مهم، یک سوال مشخص از مدیر بپرس)

## بازدیدهای بدون بازخورد
(برای هر مورد، یک سوال مشخص بپرس)

## پیشنهاد اولویت‌بندی تیم
(۱ تا ۳ پیشنهاد کوتاه، نه دستور)`,
  en: `You are the "Agency Manager Assistant" for a real-estate agency. You're given a periodic snapshot of this agency's pipeline and viewings.
Your job is a short, **question-driven** report — never just restate raw data.
For each important item (e.g. abandoned leads or feedback-less viewings), ask the manager a specific question like a trusted colleague would (e.g. "These 3 leads have been unanswered for 10 days — should I schedule follow-up?").
You must never take action on data or customers yourself — only suggest and ask; the agency manager always makes the final call.
Output in exactly this Markdown structure:
## Pipeline Summary
(2-3 sentences)

## Leads Needing Follow-up
(ask a specific question per important item)

## Viewings Without Feedback
(ask a specific question per item)

## Suggested Team Prioritization
(1-3 short suggestions, not orders)`,
} as const;

export async function generateAgencyReport(userId: string, lang: Lang, periodDays: number, onChunk?: (text: string) => void): Promise<string> {
  const effectiveLang = promptLang(lang);
  const staleThreshold = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [snapshot, abandonedLeads, feedbackNeeded] = await Promise.all([
    buildCrmSnapshot(userId),
    prisma.crmContact.findMany({
      where: { userId, status: { in: ["lead", "contacted"] }, updatedAt: { lt: staleThreshold } },
      select: { name: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),
    listFeedbackNeeded(userId),
  ]);

  const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));

  const leadLines = abandonedLeads.map((l) => `- ${l.name}: ${daysSince(l.updatedAt)} ${effectiveLang === "fa" ? "روز بدون پیگیری" : "days with no follow-up"}`).join("\n")
    || (effectiveLang === "fa" ? "هیچ لید رهاشده‌ای نیست" : "No abandoned leads");

  const viewingLines = feedbackNeeded.map((v) => `- ${v.property.title}${v.contact ? ` (${v.contact.name})` : ""}: ${effectiveLang === "fa" ? "بازدید انجام‌شده بدون بازخورد ثبت‌شده" : "viewing happened, no feedback logged"}`).join("\n")
    || (effectiveLang === "fa" ? "همهٔ بازدیدها بازخورد دارند" : "All viewings have feedback");

  const user = effectiveLang === "fa"
    ? `دورهٔ گزارش: ${periodDays} روز اخیر\n\n**Pipeline Value باز:** ${snapshot.pipelineValueOpen.toLocaleString("fa-IR")} تومان (${snapshot.totalDealsOpen} معاملهٔ باز)\n**نرخ برد:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "داده‌ای موجود نیست"}\n\n**لیدهای رهاشده (${periodDays}+ روز بدون فعالیت):**\n${leadLines}\n\n**بازدیدهای بدون بازخورد:**\n${viewingLines}`
    : `Report period: last ${periodDays} days\n\n**Open pipeline value:** ${snapshot.pipelineValueOpen.toLocaleString("en-US")} Toman (${snapshot.totalDealsOpen} open deals)\n**Win rate:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "no data"}\n\n**Abandoned leads (${periodDays}+ days inactive):**\n${leadLines}\n\n**Viewings without feedback:**\n${viewingLines}`;

  let fullOutput = "";
  await routedStreamChat(
    [{ role: "user", content: user }],
    SYSTEM[effectiveLang],
    (text) => { fullOutput += text; onChunk?.(text); },
    () => {},
    undefined,
    undefined,
    3072
  );

  return fullOutput;
}
