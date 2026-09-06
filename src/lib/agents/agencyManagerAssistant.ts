import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { buildCrmSnapshot } from "@/lib/agents/crmSnapshot";
import { listFeedbackNeeded } from "@/lib/agents/viewingCoordinator";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

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

const SYSTEM: Record<Lang, string> = {
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
  de: `Du bist der „Assistent der Maklerbüroleitung" einer Immobilienagentur. Du erhältst eine periodische Momentaufnahme der Pipeline und der Besichtigungen dieser Agentur.
Deine Aufgabe ist ein kurzer, **fragengetriebener** Bericht — gib niemals bloß die Rohdaten wieder.
Stelle zu jedem wichtigen Punkt (z. B. liegengebliebene Leads oder Besichtigungen ohne Feedback) eine konkrete Frage an die Leitung, so wie es eine vertraute Kollegin täte (z. B. „Diese 3 Leads sind seit 10 Tagen unbeantwortet — soll ich ein Follow-up einplanen?").
Du darfst niemals selbst etwas an Daten oder Kundinnen und Kunden verändern — du schlägst vor und fragst; die Entscheidung trifft immer die Leitung.
Schreibe die gesamte Ausgabe auf Deutsch.
Gliedere die Ausgabe exakt nach dieser Markdown-Struktur:
## Pipeline-Überblick
(2-3 Sätze)

## Leads mit Follow-up-Bedarf
(stelle pro wichtigem Punkt eine konkrete Frage)

## Besichtigungen ohne Feedback
(stelle pro Punkt eine konkrete Frage)

## Vorschlag zur Team-Priorisierung
(1 bis 3 kurze Vorschläge, keine Anweisungen)`,
};

export async function generateAgencyReport(userId: string, lang: Lang, periodDays: number, onChunk?: (text: string) => void): Promise<string> {
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

  const leadLines = abandonedLeads.map((l) => `- ${l.name}: ${daysSince(l.updatedAt)} ${tri(lang, "روز بدون پیگیری", "days with no follow-up", "Tage ohne Follow-up")}`).join("\n")
    || tri(lang, "هیچ لید رهاشده‌ای نیست", "No abandoned leads", "Keine liegengebliebenen Leads");

  const viewingLines = feedbackNeeded.map((v) => `- ${v.property.title}${v.contact ? ` (${v.contact.name})` : ""}: ${tri(lang, "بازدید انجام‌شده بدون بازخورد ثبت‌شده", "viewing happened, no feedback logged", "Besichtigung stattgefunden, kein Feedback erfasst")}`).join("\n")
    || tri(lang, "همهٔ بازدیدها بازخورد دارند", "All viewings have feedback", "Alle Besichtigungen haben Feedback");

  // Deliberately no currency label. pipelineValueOpen is a plain sum over every
  // open deal regardless of the currency each was priced in, so calling the
  // total "Toman" -- as both branches used to -- asserted something untrue the
  // moment an agency had a deal in EUR or TRY. The figure is passed with an
  // explicit note instead, so the model reports it without inventing a unit.
  const pipelineValue = snapshot.pipelineValueOpen.toLocaleString(tri(lang, "fa-IR", "en-US", "de-DE"));
  const currencyNote = tri(lang,
    "(مجموع خام معاملات باز؛ واحد پولی مشخص نیست — در گزارش هیچ واحدی به آن نسبت نده)",
    "(raw sum of open deals; currency unspecified — do not attach a unit to it in the report)",
    "(Rohsumme der offenen Deals; Währung nicht spezifiziert — ordne ihr im Bericht keine Einheit zu)");

  const user = tri(lang,
    `دورهٔ گزارش: ${periodDays} روز اخیر\n\n**Pipeline Value باز:** ${pipelineValue} ${currencyNote} (${snapshot.totalDealsOpen} معاملهٔ باز)\n**نرخ برد:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "داده‌ای موجود نیست"}\n\n**لیدهای رهاشده (${periodDays}+ روز بدون فعالیت):**\n${leadLines}\n\n**بازدیدهای بدون بازخورد:**\n${viewingLines}`,
    `Report period: last ${periodDays} days\n\n**Open pipeline value:** ${pipelineValue} ${currencyNote} (${snapshot.totalDealsOpen} open deals)\n**Win rate:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "no data"}\n\n**Abandoned leads (${periodDays}+ days inactive):**\n${leadLines}\n\n**Viewings without feedback:**\n${viewingLines}`,
    `Berichtszeitraum: letzte ${periodDays} Tage\n\n**Offener Pipeline-Wert:** ${pipelineValue} ${currencyNote} (${snapshot.totalDealsOpen} offene Deals)\n**Gewinnrate:** ${snapshot.winRate !== null ? `${snapshot.winRate}%` : "keine Daten"}\n\n**Liegengebliebene Leads (${periodDays}+ Tage ohne Aktivität):**\n${leadLines}\n\n**Besichtigungen ohne Feedback:**\n${viewingLines}`);

  let fullOutput = "";
  await routedStreamChat(
    [{ role: "user", content: user }],
    SYSTEM[lang],
    (text) => { fullOutput += text; onChunk?.(text); },
    () => {},
    undefined,
    undefined,
    3072
  );

  return fullOutput;
}
