import { prisma } from "@/lib/db/prisma";
import { accountName } from "@/lib/accounting/accountName";
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
  lang?: "fa" | "en" | "de";
}

export async function createScheduledReport(input: CreateScheduledReportInput) {
  return prisma.accountingScheduledReport.create({
    data: {
      workspaceUserId: input.workspaceUserId,
      reportType: input.reportType,
      frequency: input.frequency,
      recipientEmail: input.recipientEmail,
      lang: input.lang || "fa",
    },
  });
}

export async function listScheduledReports(workspaceUserId: string) {
  return prisma.accountingScheduledReport.findMany({ where: { workspaceUserId }, orderBy: { createdAt: "asc" } });
}

export async function pauseScheduledReport(id: string, workspaceUserId: string) {
  const report = await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  if (report.status !== "active") throw new Error("Only an active schedule can be paused");
  return prisma.accountingScheduledReport.update({ where: { id }, data: { status: "paused" } });
}

export async function resumeScheduledReport(id: string, workspaceUserId: string) {
  const report = await prisma.accountingScheduledReport.findFirstOrThrow({ where: { id, workspaceUserId } });
  if (report.status !== "paused") throw new Error("Only a paused schedule can be resumed");
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
export async function renderReportContent(workspaceUserId: string, reportType: ReportType, frequency: Frequency, lang: "fa" | "en" | "de", now: Date = new Date()) {
  const { from, to, label } = periodFor(frequency, now);
  const isFa = lang === "fa";

  if (reportType === "monthly_vat") {
    const vat = await getVatReport(workspaceUserId, from, to);
    const subject = isFa ? `گزارش مالیات بر ارزش‌افزوده — ${label}` : `VAT Report — ${label}`;
    const html = `<div dir="${isFa ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial;padding:24px;">
      <h2>${subject}</h2>
      <table style="margin-top:12px;"><tbody>
        <tr><td style="padding:4px 12px;color:#666;">${isFa ? "مالیات فروش (خروجی)" : "Output Tax"}</td><td style="padding:4px 12px;font-weight:bold;">${vat.outputTax.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${isFa ? "مالیات خرید (ورودی)" : "Input Tax"}</td><td style="padding:4px 12px;">${vat.inputTax.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">${isFa ? "مبلغ قابل پرداخت" : "Net Payable"}</td><td style="padding:4px 12px;font-weight:bold;color:#ea580c;">${vat.netPayable.toLocaleString()}</td></tr>
      </tbody></table></div>`;
    return { subject, html };
  }

  const pl = await getProfitAndLoss(workspaceUserId, from, to);
  const trialBalance = await getTrialBalance(workspaceUserId, to);
  const cashRow = trialBalance.find((r) => r.code === "1000");

  const subjectLabel = reportType === "weekly_summary" ? (isFa ? "خلاصه هفتگی مالی" : "Weekly Financial Summary") : (isFa ? "صورت سود و زیان ماهانه" : "Monthly P&L");
  const subject = `${subjectLabel} — ${label}`;
  const rows = pl.expenseByAccount
    .map((e) => `<tr><td style="padding:6px;border-bottom:1px solid #eee;">${accountName(e, lang)}</td><td style="padding:6px;border-bottom:1px solid #eee;">${e.amount.toLocaleString()}</td></tr>`)
    .join("");
  const html = `<div dir="${isFa ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial;padding:24px;">
    <h2>${subject}</h2>
    <table style="margin:12px 0;"><tbody>
      <tr><td style="padding:4px 12px;color:#666;">${isFa ? "درآمد" : "Revenue"}</td><td style="padding:4px 12px;font-weight:bold;color:#16a34a;">${pl.revenueTotal.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${isFa ? "هزینه" : "Expense"}</td><td style="padding:4px 12px;color:#dc2626;">${pl.expenseTotal.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${isFa ? "سود خالص" : "Net Profit"}</td><td style="padding:4px 12px;font-weight:bold;">${pl.netProfit.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 12px;color:#666;">${isFa ? "موجودی نقدی" : "Cash Balance"}</td><td style="padding:4px 12px;">${(cashRow?.balance || 0).toLocaleString()}</td></tr>
    </tbody></table>
    <table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:${isFa ? "right" : "left"};padding:6px;">${isFa ? "دسته هزینه" : "Expense Category"}</th><th style="text-align:${isFa ? "right" : "left"};padding:6px;">${isFa ? "مبلغ" : "Amount"}</th></tr></thead><tbody>${rows}</tbody></table>
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
      const content = await renderReportContent(report.workspaceUserId, report.reportType as ReportType, report.frequency as Frequency, report.lang as "fa" | "en" | "de", now);

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
    throw new Error("This schedule has no pending preview to approve");
  }
  const content = JSON.parse(report.firstRunPreview) as { subject: string; html: string };
  const ok = await sendEmail(report.recipientEmail, content.subject, content.html);
  if (!ok) throw new Error("Failed to send the approved report email");

  return prisma.accountingScheduledReport.update({
    where: { id },
    data: { status: "active", lastRunAt: new Date(), firstRunPreview: null },
  });
}
