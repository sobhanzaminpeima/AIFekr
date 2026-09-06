import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

/**
 * The business snapshot behind the dashboard home page.
 *
 * The point of this page is not "show some cards" — it is to answer the only
 * question a business owner actually opens the app with: *what needs me
 * today?* So the shape here is deliberately two-part:
 *
 *   - `stats`  — a small, honest set of counts. Never padded with a metric
 *                just to fill a grid.
 *   - `attention` — the prioritised work list. Every entry is a real row from
 *                CRM/accounting with a link straight to the place it is fixed.
 *                If this array is empty the page says so plainly rather than
 *                inventing filler.
 *
 * Everything is scoped to the caller's workspace, same rule as every other
 * CRM/accounting read.
 */

export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  /** Sort key — bigger is more urgent. */
  weight: number;
}

export interface HomeSummary {
  stats: {
    activeDeals: number;
    pipelineValue: number;
    newLeadsThisWeek: number;
    overdueInvoiceCount: number;
    overdueInvoiceTotal: number;
    monthRevenue: number;
    upcomingViewings: number;
  };
  attention: AttentionItem[];
  /** True when the workspace has essentially no data yet — the page shows a getting-started state instead. */
  isEmptyWorkspace: boolean;
}

const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = { critical: 300, warning: 200, info: 100 };

export async function getHomeSummary(workspaceUserId: string, lang: Lang): Promise<HomeSummary> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    openDeals, newLeads, overdueInvoices, overdueTasks,
    draftStatements, unreconciledCount, upcomingViewings, paidThisMonth, contactCount,
  ] = await Promise.all([
    prisma.crmDeal.findMany({
      where: { userId: workspaceUserId, status: "open" },
      select: { id: true, value: true },
    }),
    prisma.crmContact.count({ where: { userId: workspaceUserId, createdAt: { gte: weekAgo } } }),
    prisma.crmInvoice.findMany({
      where: { userId: workspaceUserId, status: { in: ["sent", "overdue"] }, dueDate: { lt: now } },
      include: { contact: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.crmTask.findMany({
      where: { userId: workspaceUserId, status: { not: "done" }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.accountingOwnerStatement.count({ where: { workspaceUserId, status: "draft" } }),
    prisma.accountingBankTransaction.count({ where: { workspaceUserId, status: "unmatched" } }),
    prisma.propertyViewing.count({
      where: { property: { userId: workspaceUserId }, scheduledAt: { gte: now, lte: inSevenDays } },
    }),
    prisma.crmInvoice.aggregate({
      where: { userId: workspaceUserId, status: "paid", paidAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.crmContact.count({ where: { userId: workspaceUserId } }),
  ]);

  const attention: AttentionItem[] = [];

  for (const inv of overdueInvoices) {
    const daysLate = inv.dueDate ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000) : 0;
    attention.push({
      id: `invoice:${inv.id}`,
      severity: daysLate > 14 ? "critical" : "warning",
      title: tri(lang, `فاکتور ${inv.invoiceNumber} پرداخت نشده`, `Invoice ${inv.invoiceNumber} is unpaid`, `Rechnung ${inv.invoiceNumber} ist offen`),
      detail: tri(lang,
        `${inv.contact.name} — ${daysLate} روز گذشته`,
        `${inv.contact.name} — ${daysLate} days overdue`,
        `${inv.contact.name} — ${daysLate} Tage überfällig`),
      href: "/crm?tab=invoices",
      weight: SEVERITY_WEIGHT[daysLate > 14 ? "critical" : "warning"] + daysLate,
    });
  }

  for (const task of overdueTasks) {
    attention.push({
      id: `task:${task.id}`,
      severity: "warning",
      title: task.title,
      detail: tri(lang, "این کار سررسیدش گذشته", "This task is past its due date", "Diese Aufgabe ist überfällig"),
      href: "/crm",
      weight: SEVERITY_WEIGHT.warning,
    });
  }

  if (draftStatements > 0) {
    attention.push({
      id: "statements:draft",
      severity: "info",
      title: tri(lang,
        `${draftStatements} گزارش تسویه در انتظار تأیید`,
        `${draftStatements} owner statements awaiting approval`,
        `${draftStatements} Eigentümerabrechnungen warten auf Freigabe`),
      detail: tri(lang, "تا تأیید نشوند برای مالک ارسال نمی‌شوند", "They are not sent to the owner until you approve them", "Sie werden erst nach Ihrer Freigabe an den Eigentümer gesendet"),
      href: "/accounting/owner-statements",
      weight: SEVERITY_WEIGHT.info + 10,
    });
  }

  if (unreconciledCount > 0) {
    attention.push({
      id: "bank:unreconciled",
      severity: "info",
      title: tri(lang,
        `${unreconciledCount} تراکنش بانکی تطبیق نشده`,
        `${unreconciledCount} bank transactions unreconciled`,
        `${unreconciledCount} Bankbuchungen nicht abgeglichen`),
      detail: tri(lang, "تا تطبیق نشوند گزارش‌های مالی کامل نیستند", "Your financial reports stay incomplete until these are matched", "Ihre Finanzberichte bleiben unvollständig, bis diese abgeglichen sind"),
      href: "/accounting/bank",
      weight: SEVERITY_WEIGHT.info,
    });
  }

  attention.sort((a, b) => b.weight - a.weight);

  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.total, 0);

  return {
    stats: {
      activeDeals: openDeals.length,
      pipelineValue: openDeals.reduce((s, d) => s + d.value, 0),
      newLeadsThisWeek: newLeads,
      overdueInvoiceCount: overdueInvoices.length,
      overdueInvoiceTotal: overdueTotal,
      monthRevenue: paidThisMonth._sum.total ?? 0,
      upcomingViewings,
    },
    attention: attention.slice(0, 8),
    isEmptyWorkspace: contactCount === 0 && openDeals.length === 0,
  };
}
