import { prisma } from "@/lib/db/prisma";
import { getTrialBalance, getProfitAndLoss } from "./reports";

export interface DashboardData {
  cashBalance: number;
  receivablesOutstanding: number;
  payablesOutstanding: number;
  monthRevenue: number;
  monthExpense: number;
  monthNetProfit: number;
  /** Last 6 months, oldest first — for the revenue/expense trend chart. */
  trend: { label: string; revenue: number; expense: number }[];
  expenseByCategory: { code: string; name: string; nameEn: string | null; amount: number }[];
  overdueInvoices: { id: string; invoiceNumber: string; total: number; dueDate: Date | null; contactName: string }[];
  pendingCommissions: { id: string; dealTitle: string; agentUserId: string; amount: number }[];
  bankUnreconciledCount: number;
  shortTermRental: {
    activeUnits: number;
    monthManagementFeeTotal: number;
    pendingStatements: number;
  };
}

export async function getDashboardData(workspaceUserId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [trialBalance, monthPL, invoices, commissionRecords, properties, bankUnreconciledCount, statements] = await Promise.all([
    getTrialBalance(workspaceUserId),
    getProfitAndLoss(workspaceUserId, monthStart, now),
    prisma.crmInvoice.findMany({
      where: { userId: workspaceUserId, status: { in: ["sent", "overdue"] }, dueDate: { lt: now } },
      include: { contact: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.accountingCommissionSplit.findMany({
      where: { status: "pending", commissionRecord: { workspaceUserId } },
      include: { commissionRecord: { include: { deal: { select: { title: true } } } } },
      take: 10,
    }),
    prisma.property.findMany({ where: { userId: workspaceUserId, listingType: "short_term_rent" }, select: { id: true } }),
    prisma.accountingBankTransaction.count({ where: { workspaceUserId, status: "unmatched" } }),
    // Two distinct things, deliberately queried separately: "fee actually
    // earned this month" only counts recognized (approved/sent) statements —
    // a draft's numbers are provisional and could still change — while
    // "pending review" is the draft count itself.
    prisma.accountingOwnerStatement.findMany({ where: { workspaceUserId, status: { in: ["approved", "sent"] } }, select: { id: true, managementFee: true, month: true } }),
  ]);

  const pendingStatementCount = await prisma.accountingOwnerStatement.count({ where: { workspaceUserId, status: "draft" } });

  const cashRow = trialBalance.find((r) => r.code === "1000");
  const receivableRow = trialBalance.find((r) => r.code === "1200");
  const payableRow = trialBalance.find((r) => r.code === "2000");

  const trend: DashboardData["trend"] = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = i === 0 ? now : new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const pl = await getProfitAndLoss(workspaceUserId, from, to);
    trend.push({ label: from.toLocaleDateString("fa-IR", { month: "short" }), revenue: pl.revenueTotal, expense: pl.expenseTotal });
  }

  const thisMonthStatementFee = statements
    .filter((s) => s.month.getMonth() === now.getMonth() && s.month.getFullYear() === now.getFullYear())
    .reduce((sum, s) => sum + s.managementFee, 0);

  return {
    cashBalance: cashRow?.balance || 0,
    receivablesOutstanding: receivableRow?.balance || 0,
    payablesOutstanding: payableRow?.balance || 0,
    monthRevenue: monthPL.revenueTotal,
    monthExpense: monthPL.expenseTotal,
    monthNetProfit: monthPL.netProfit,
    trend,
    expenseByCategory: monthPL.expenseByAccount,
    overdueInvoices: invoices.map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, total: inv.total, dueDate: inv.dueDate, contactName: inv.contact.name })),
    pendingCommissions: commissionRecords.map((s) => ({ id: s.id, dealTitle: s.commissionRecord.deal.title, agentUserId: s.agentUserId, amount: s.amount })),
    bankUnreconciledCount,
    shortTermRental: {
      activeUnits: properties.length,
      monthManagementFeeTotal: thisMonthStatementFee,
      pendingStatements: pendingStatementCount,
    },
  };
}
