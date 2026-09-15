import { prisma } from "@/lib/db/prisma";
import { accountName } from "@/lib/accounting/accountName";
import { tri } from "@/lib/i18n/tri";
import {
  getFxSnapshot, convert, formatReportAmount, rateDisclosure, conversionUnavailable, getWorkspaceCurrency,
} from "@/lib/accounting/reportingFx";
import { getProfitAndLoss, getTrialBalance } from "./reports";
import { getVatReport } from "./tax";
import { sendEmail } from "@/lib/email/resend";

/**
 * Scheduled emailed reports (spec ۴ "گزارش‌های زمان‌بندی‌شده"). Per the master
 * prompt's explicit rule for this phase: "ارسال خودکار گزارش زمان‌بندی‌شده —
 * با تأیید صریح محتوای اولین اجرا قبل از فعال‌سازی خودکار دائمی" — a newly
 * created schedule's first due run is never emailed automatically. It only
 * renders a preview into firstRunPreview and waits in "awaiting_approval";
 * a human must review that exact content and call approveFirstRun() before
 * the recurring automatic send is switched on. Every later run (once
 * "active") sends automatically without asking again — that ongoing
 * automation is what was explicitly approved.
 */

export type ReportType = "weekly_summary" | "monthly_pl" | "monthly_vat";
export type Frequency = "weekly" | "monthly";

export interface CreateScheduledReportInput {
  workspaceUserId: string;
  reportType: ReportType;
  frequency: Frequency;
  recipientEmail: string;
  lang?: "fa" | "en" | "de" | "tr";
  /** Presentation currency. Omitted means no conversion. */
  currency?: string | null;
}

export async function createScheduledReport(input: CreateScheduledReportInput) {
  return prisma.accountingScheduledReport.create({
    data: {
      workspaceUserId: input.workspaceUserId,
      reportType: input.reportType,
      frequency: input.frequency,
      recipientEmail: input.recipientEmail,
      lang: input.lang || "fa",
      currency: input.currency || null,
    },
  });
}

export async function listScheduledReports(workspaceUserId: string) {
  return prisma.accountingScheduledReport.findMany({ where: { workspaceUserId }, orderBy: { createdAt: "asc" } });
}

export async function pauseScheduledReport(id: string, workspaceUserId: string) {
  const report = await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  // Same class of bug as approveFirstRun's error below: hardcoded English,
  // passed straight to the client as err.message regardless of UI language.
  if (report.status !== "active") {
    throw new Error(tri(report.lang as "fa" | "en" | "de" | "tr", "فقط زمان‌بندی فعال قابل توقف است", "Only an active schedule can be paused", "Nur ein aktiver Zeitplan kann pausiert werden"));
  }
  return prisma.accountingScheduledReport.update({ where: { id }, data: { status: "paused" } });
}

export async function resumeScheduledReport(id: string, workspaceUserId: string) {
  const report = await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  if (report.status !== "paused") {
    throw new Error(tri(report.lang as "fa" | "en" | "de" | "tr", "فقط زمان‌بندی متوقف‌شده قابل ازسرگیری است", "Only a paused schedule can be resumed", "Nur ein pausierter Zeitplan kann fortgesetzt werden"));
  }
  return prisma.accountingScheduledReport.update({ where: { id }, data: { status: "active" } });
}

export async function deleteScheduledReport(id: string, workspaceUserId: string) {
  await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  return prisma.accountingScheduledReport.delete({ where: { id } });
}

function periodFor(frequency: Frequency, now: Date): { from: Date; to: Date; label: string } {
  if (frequency === "weekly") {
    const to = now;
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to, label: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}` };
  }
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
  return { from: monthStart, to: monthEnd, label: monthStart.toLocaleDateString("en-US", { year: "numeric", month: "long" }) };
}

/** Renders the report content for one schedule at `now` — pure/no side effects, used for both the preview and the real send. */
export async function renderReportContent(
  workspaceUserId: string,
  reportType: ReportType,
  frequency: Frequency,
  lang: "fa" | "en" | "de" | "tr",
  now: Date = new Date(),
  /** Presentation currency. Undefined/null means show recorded amounts only. */
  presentationCurrency?: string | null,
) {
  const { from, to, label } = periodFor(frequency, now);
  const isFa = lang === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const align = isFa ? "right" : "left";

  // The ledger records in one currency; conversion is additional information
  // layered on top, and only when a real dated rate could be obtained.
  const sourceCurrency = await getWorkspaceCurrency(workspaceUserId);
  const wantsConversion = !!presentationCurrency && presentationCurrency !== sourceCurrency;
  const snap = wantsConversion ? await getFxSnapshot() : null;
  const conv = snap && presentationCurrency ? convert(1, sourceCurrency, presentationCurrency, snap) : null;

  /** Recorded amount, then the converted one beside it when there is a rate. */
  const money = (amount: number) => {
    const recorded = formatReportAmount(amount, sourceCurrency, lang);
    if (!conv || !presentationCurrency) return recorded;
    return `${recorded} <span style="color:#888;">(${formatReportAmount(amount * conv.rate, presentationCurrency, lang)})</span>`;
  };

  const footer = wantsConversion
    ? `<p style="margin-top:18px;font-size:12px;color:#666;line-height:1.7;border-top:1px solid #eee;padding-top:10px;">${
        conv && snap && presentationCurrency
          ? rateDisclosure(sourceCurrency, presentationCurrency, conv.rate, snap, lang)
          : conversionUnavailable(lang)
      }</p>`
    : "";

  if (reportType === "monthly_vat") {
    const vat = await getVatReport(workspaceUserId, from, to);
    const subject = `${tri(lang, "گزارش مالیات بر ارزش‌افزوده", "VAT Report", "Umsatzsteuerbericht")} — ${label}`;
    const html = `<div dir="${dir}" style="font-family:Tahoma,Arial;padding:24px;">
      <h2>${subject}</h2>
      <table style="margin-top:12px;"><tbody>
        <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "مالیات فروش (خروجی)", "Output tax", "Umsatzsteuer")}</td><td style="padding:4px 12px;font-weight:bold;">${money(vat.outputTax)}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "مالیات خرید (ورودی)", "Input tax", "Vorsteuer")}</td><td style="padding:4px 12px;">${money(vat.inputTax)}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "مبلغ قابل پرداخت", "Net payable", "Zahllast")}</td><td style="padding:4px 12px;font-weight:bold;color:#ea580c;">${money(vat.netPayable)}</td></tr>
      </tbody></table>${footer}</div>`;
    return { subject, html };
  }

  const pl = await getProfitAndLoss(workspaceUserId, from, to);
  const trialBalance = await getTrialBalance(workspaceUserId, to);
  const cashRow = trialBalance.find((r) => r.code === "1000");

  const subjectLabel = reportType === "weekly_summary"
    ? tri(lang, "خلاصه هفتگی مالی", "Weekly financial summary", "Wöchentliche Finanzübersicht")
    : tri(lang, "صورت سود و زیان ماهانه", "Monthly profit & loss", "Monatliche Gewinn- und Verlustrechnung");
  const subject = `${subjectLabel} — ${label}`;
  const rows = pl.expenseByAccount
    .map((e) => `<tr><td style="padding:6px;border-bottom:1px solid #eee;">${accountName(e, lang)}</td><td style="padding:6px;border-bottom:1px solid #eee;">${money(e.amount)}</td></tr>`)
    .join("");
  const html = `<div dir="${dir}" style="font-family:Tahoma,Arial;padding:24px;">
    <h2>${subject}</h2>
    <table style="margin:12px 0;"><tbody>
      <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "درآمد", "Revenue", "Umsatz")}</td><td style="padding:4px 12px;font-weight:bold;color:#16a34a;">${money(pl.revenueTotal)}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "هزینه", "Expenses", "Aufwendungen")}</td><td style="padding:4px 12px;color:#dc2626;">${money(pl.expenseTotal)}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "سود خالص", "Net profit", "Nettogewinn")}</td><td style="padding:4px 12px;font-weight:bold;">${money(pl.netProfit)}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${tri(lang, "موجودی نقدی", "Cash balance", "Kassenbestand")}</td><td style="padding:4px 12px;">${money(cashRow?.balance || 0)}</td></tr>
    </tbody></table>
    <table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:${align};padding:6px;">${tri(lang, "دسته هزینه", "Expense category", "Aufwandsart")}</th><th style="text-align:${align};padding:6px;">${tri(lang, "مبلغ", "Amount", "Betrag")}</th></tr></thead><tbody>${rows}</tbody></table>
    ${footer}
  </div>`;
  return { subject, html };
}

/**
 * The cron entrypoint (called by /api/cron/accounting-scheduled-reports).
 * Due = never run before, or lastRunAt older than the schedule's interval.
 * A "pending_first_approval" schedule is only ever previewed here, never
 * sent — see the module doc comment above.
 */
export async function runDueScheduledReports(now: Date = new Date()): Promise<{ previewed: number; sent: number; errors: string[] }> {
  const reports = await prisma.accountingScheduledReport.findMany({ where: { status: { in: ["pending_first_approval", "active"] } } });
  let previewed = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const report of reports) {
    const intervalMs = (report.frequency === "weekly" ? 7 : 30) * 24 * 60 * 60 * 1000;
    const isDue = !report.lastRunAt || now.getTime() - report.lastRunAt.getTime() >= intervalMs;
    if (!isDue) continue;

    try {
      const content = await renderReportContent(report.workspaceUserId, report.reportType as ReportType, report.frequency as Frequency, report.lang as "fa" | "en" | "de" | "tr", now, report.currency);

      if (report.status === "pending_first_approval") {
        await prisma.accountingScheduledReport.update({
          where: { id: report.id },
          data: { status: "awaiting_approval", firstRunPreview: JSON.stringify(content) },
        });
        previewed++;
      } else {
        const ok = await sendEmail(report.recipientEmail, content.subject, content.html);
        if (!ok) throw new Error("sendEmail returned false");
        await prisma.accountingScheduledReport.update({ where: { id: report.id }, data: { lastRunAt: now } });
        sent++;
      }
    } catch (err) {
      errors.push(`${report.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { previewed, sent, errors };
}

/**
 * The human-approval step: sends the exact previewed content right now (this
 * IS the "first run"), then switches the schedule to "active" so every
 * future due run sends automatically without asking again.
 */
export async function approveFirstRun(id: string, workspaceUserId: string) {
  const report = await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  if (report.status !== "awaiting_approval" || !report.firstRunPreview) {
    throw new Error(tri(report.lang as "fa" | "en" | "de" | "tr", "این زمان‌بندی پیش‌نمایشی برای تأیید ندارد", "This schedule has no pending preview to approve", "Für diesen Zeitplan gibt es keine ausstehende Vorschau zur Genehmigung"));
  }
  const content = JSON.parse(report.firstRunPreview) as { subject: string; html: string };
  const ok = await sendEmail(report.recipientEmail, content.subject, content.html);
  // Was a hardcoded English Error(), which the API route's `err.message`
  // passed straight to the client regardless of UI language -- a Persian/
  // German user approving a report saw this line in English. `lang` is
  // already loaded on this row for exactly this kind of message.
  if (!ok) {
    throw new Error(tri(
      report.lang as "fa" | "en" | "de" | "tr",
      "ارسال ایمیل گزارش تأییدشده ناموفق بود — تنظیمات ایمیل سرور را بررسی کنید",
      "Failed to send the approved report email — check the server's email configuration",
      "Der E-Mail-Versand des genehmigten Berichts ist fehlgeschlagen — prüfen Sie die E-Mail-Konfiguration des Servers"
    ));
  }

  return prisma.accountingScheduledReport.update({
    where: { id },
    data: { status: "active", lastRunAt: new Date(), firstRunPreview: null },
  });
}
