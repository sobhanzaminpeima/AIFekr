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

/**
 * One thing an AI agent actually did — never a placeholder, never a "your team
 * is standing by" message. If nothing ran, the array is empty and the page
 * omits the section entirely (Phase 5, proposal 3).
 */
export interface TeamActivityItem {
  id: string;
  /** Which teammate did it — used for the icon, not shown raw. */
  agent: "ceo" | "content";
  title: string;
  detail: string;
  href: string;
  at: Date;
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
  /** What the AI team actually did in the last 7 days. Empty when it did nothing. */
  teamActivity: TeamActivityItem[];
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
    ceoNotes, contentRuns,
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
    // Phase 5, proposal 3 -- the dashboard showed data conditions but never
    // said what the AI team had done, so the "your team works for you" promise
    // on /ai-team had no counterpart anywhere in the product. Both reads are
    // of work that already happened; nothing here is generated for display.
    prisma.businessMemory.findMany({
      where: { userId: workspaceUserId, source: "ceo", createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, text: true, category: true, createdAt: true },
    }),
    prisma.contentPipelineRun.findMany({
      where: { userId: workspaceUserId, status: "done", updatedAt: { gte: weekAgo } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true, topic: true, updatedAt: true,
        steps: { where: { agentKey: "editor" }, orderBy: { createdAt: "desc" }, take: 1, select: { score: true } },
      },
    }),
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

  const teamActivity: TeamActivityItem[] = [
    ...ceoNotes.map((n) => ({
      id: `ceo:${n.id}`,
      agent: "ceo" as const,
      title: tri(lang, "مدیرعامل هوش مصنوعی کسب‌وکار را بررسی کرد", "Your AI CEO reviewed the business", "Ihr KI-CEO hat das Unternehmen geprüft"),
      // The note itself is the evidence -- shown verbatim rather than summarised,
      // so the card can never claim something the agent did not actually write.
      detail: n.text,
      href: "/ceo/orchestrator",
      at: n.createdAt,
    })),
    ...contentRuns.map((r) => {
      const score = r.steps[0]?.score;
      return {
        id: `content:${r.id}`,
        agent: "content" as const,
        title: tri(lang, "تیم محتوا یک مقاله را کامل کرد", "The content team finished an article", "Das Content-Team hat einen Artikel fertiggestellt"),
        detail: score != null
          ? tri(lang, `«${r.topic}» — امتیاز ویراستار: ${score}/100`, `"${r.topic}" — editor score: ${score}/100`, `„${r.topic}" — Redaktionsbewertung: ${score}/100`)
          : r.topic,
        href: "/seo/agent-pipeline",
        at: r.updatedAt,
      };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 5);

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
    teamActivity,
    isEmptyWorkspace: contactCount === 0 && openDeals.length === 0,
  };
}
