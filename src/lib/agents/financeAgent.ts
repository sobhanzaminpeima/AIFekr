import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Provider } from "@/lib/ai/providers";
import { getTrialBalance, getProfitAndLoss } from "@/lib/accounting/reports";
import { getVatReport } from "@/lib/accounting/tax";
import { getBudgetVsActual, getCashFlowForecast } from "@/lib/accounting/budget";
import { postJournalEntry, PostJournalLineInput } from "@/lib/accounting/ledger";

/**
 * Finance AI Agent (spec ۸, Phase E). Built only after Phases A–D were live
 * and tested on production, per the master prompt's explicit ordering rule —
 * an AI reading an incomplete/unbalanced ledger produces wrong answers.
 *
 * Hard boundaries enforced by this file (spec ۸.۴, never to be relaxed):
 *  - READ access is exclusively through the existing report functions
 *    (reports.ts/tax.ts/budget.ts) — never raw SQL, never a direct table
 *    read the agent constructs itself. Same tenant isolation as the rest of
 *    the module: every call takes a workspaceUserId resolved server-side via
 *    resolveCrmWorkspace() in the API route, never something the model can
 *    influence.
 *  - The ONLY write path is proposeJournalEntry()/proposeExpenseCategorization()
 *    below, and both do nothing but insert a "pending" AccountingAiProposal
 *    row. Approving/rejecting a proposal is a separate, human-triggered call
 *    (approveProposal/rejectProposal) — the agent itself never posts to the
 *    ledger, never pays an expense, never closes a period, and never touches
 *    another workspace's data.
 *  - Every AI answer and every proposal is written to AuditLog with
 *    action-prefix "finance_ai_" and metadata.source = "ai_agent" plus the
 *    provider id used, so it's traceable in the UI back to this call.
 */

const SYSTEM_QA = `تو یک تحلیل‌گر مالی ارشد هستی که فقط و فقط بر اساس داده‌های واقعی زیر به سؤال کاربر دربارهٔ وضعیت مالی کسب‌وکارش پاسخ می‌دهی.

قوانین سخت‌گیرانه:
- هرگز عددی نساز که در داده‌های زیر نیامده — اگر پاسخ سؤال در داده‌ها نیست، صریح بگو "این اطلاعات در داده‌های فعلی موجود نیست".
- برای هر عدد مهم، کد حساب یا شناسهٔ رکورد مرتبط را داخل پرانتز ذکر کن (مثلاً "۴۴۰,۰۰۰ تومان (حساب ۵۰۰۰)") — این استناد اجباری است.
- تو هیچ دسترسی نوشتن به دفتر کل نداری و نمی‌توانی سندی ثبت، پرداختی انجام، یا دوره‌ای را ببندی — اگر کاربر چنین درخواستی کرد، توضیح بده که این کار نیاز به تأیید دستی یک انسان دارد.
- کل پاسخ را کوتاه، دقیق و فقط به فارسی بنویس.`;

async function auditAi(workspaceUserId: string, action: string, provider: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { actorId: workspaceUserId, action: `finance_ai_${action}`, metadata: JSON.stringify({ source: "ai_agent", model: provider, ...metadata }) },
  }).catch(() => {});
}

interface FinanceSnapshot {
  trialBalance: Awaited<ReturnType<typeof getTrialBalance>>;
  monthPL: Awaited<ReturnType<typeof getProfitAndLoss>>;
  vat: Awaited<ReturnType<typeof getVatReport>>;
  budgetVsActual: Awaited<ReturnType<typeof getBudgetVsActual>>;
  cashFlowForecast: Awaited<ReturnType<typeof getCashFlowForecast>>;
}

/** Pulls the same read-only, already-computed numbers the dashboard uses — never a second, AI-only data path. */
async function buildFinanceSnapshot(workspaceUserId: string): Promise<FinanceSnapshot> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [trialBalance, monthPL, vat, budgetVsActual, cashFlowForecast] = await Promise.all([
    getTrialBalance(workspaceUserId),
    getProfitAndLoss(workspaceUserId, monthStart, now),
    getVatReport(workspaceUserId, monthStart, now),
    getBudgetVsActual(workspaceUserId, monthStart),
    getCashFlowForecast(workspaceUserId, 3),
  ]);
  return { trialBalance, monthPL, vat, budgetVsActual, cashFlowForecast };
}

function formatSnapshot(s: FinanceSnapshot): string {
  const tb = s.trialBalance.map((r) => `- ${r.name} (حساب ${r.code}): مانده ${r.balance.toLocaleString("fa-IR")}`).join("\n") || "بدون فعالیت ثبت‌شده";
  const exp = s.monthPL.expenseByAccount.map((e) => `- ${e.name} (حساب ${e.code}): ${e.amount.toLocaleString("fa-IR")}`).join("\n") || "بدون هزینه این ماه";
  const budget = s.budgetVsActual.map((b) => `- حساب ${b.accountCode} (${b.accountName}): بودجه ${b.budgeted.toLocaleString("fa-IR")}, واقعی ${b.actual.toLocaleString("fa-IR")}, انحراف ${b.variancePercent}%`).join("\n") || "بودجه‌ای تعریف نشده";
  const forecast = s.cashFlowForecast.map((f, i) => `- ماه ${i + 1}: ورودی موردانتظار ${f.expectedInflow.toLocaleString("fa-IR")}, خروجی موردانتظار ${f.expectedOutflow.toLocaleString("fa-IR")}`).join("\n");

  return `**تراز آزمایشی:**\n${tb}\n
**سود و زیان ماه جاری:** درآمد ${s.monthPL.revenueTotal.toLocaleString("fa-IR")}, هزینه ${s.monthPL.expenseTotal.toLocaleString("fa-IR")}, سود خالص ${s.monthPL.netProfit.toLocaleString("fa-IR")}
**تفکیک هزینه‌های ماه:**\n${exp}\n
**مالیات بر ارزش‌افزوده ماه جاری:** خروجی ${s.vat.outputTax.toLocaleString("fa-IR")}, ورودی ${s.vat.inputTax.toLocaleString("fa-IR")}, قابل‌پرداخت ${s.vat.netPayable.toLocaleString("fa-IR")}
**بودجه در برابر واقعی:**\n${budget}\n
**پیش‌بینی جریان نقدی (۳ ماه آینده):**\n${forecast}`;
}

/**
 * Natural-language Q&A over the ledger (spec ۸ item ۱). Streams the answer
 * like the other agents in this codebase (crmAgent.runCrmAnalysis) and logs
 * the Q&A to AuditLog for traceability — this call never writes anything to
 * the ledger itself.
 */
export async function askFinanceAgent(workspaceUserId: string, question: string, onChunk: (text: string) => void): Promise<string> {
  const snapshot = await buildFinanceSnapshot(workspaceUserId);
  const prompt = `${formatSnapshot(snapshot)}\n\n**سؤال کاربر:** ${question}`;

  let fullOutput = "";
  let usedProvider: Provider | null = null;
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    SYSTEM_QA,
    (text) => { fullOutput += text; onChunk(text); },
    (provider) => { usedProvider = provider; },
    undefined,
    undefined,
    2048
  );

  await auditAi(workspaceUserId, "qa", (usedProvider as Provider | null)?.id || "unknown", { question });
  return fullOutput;
}

export interface AnomalyAlert {
  accountCode: string;
  accountName: string;
  currentMonthAmount: number;
  trailingAverage: number;
  deviationPercent: number;
}

/**
 * Anomaly detection (spec ۸ item ۳) — a deterministic statistical heuristic,
 * not an LLM call: comparing this month's expense-by-account against the
 * trailing 3-month average is more reliable (and cheaper) than asking a
 * model to eyeball numbers, and the spec only requires an alert, not a
 * narrative. Purely informational — flags, never acts.
 */
export async function detectAnomalies(workspaceUserId: string, thresholdPercent: number = 50): Promise<AnomalyAlert[]> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = await getProfitAndLoss(workspaceUserId, monthStart, now);

  const trailingMonths = await Promise.all(
    [1, 2, 3].map((i) => {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      return getProfitAndLoss(workspaceUserId, from, to);
    })
  );

  const alerts: AnomalyAlert[] = [];
  for (const current of currentMonth.expenseByAccount) {
    const priorAmounts = trailingMonths.map((m) => m.expenseByAccount.find((e) => e.code === current.code)?.amount || 0);
    const trailingAverage = priorAmounts.reduce((s, a) => s + a, 0) / priorAmounts.length;
    if (trailingAverage < 1) continue; // no meaningful baseline yet
    const deviationPercent = Math.round(((current.amount - trailingAverage) / trailingAverage) * 100);
    if (Math.abs(deviationPercent) >= thresholdPercent) {
      alerts.push({ accountCode: current.code, accountName: current.name, currentMonthAmount: current.amount, trailingAverage, deviationPercent });
    }
  }
  return alerts;
}

// --- Draft-and-Approve proposals — the agent's only write path -------------

export interface ProposeJournalEntryInput {
  workspaceUserId: string;
  lines: PostJournalLineInput[];
  memo: string;
  requestedBy: string;
  sourceContext?: string;
}

/** Creates a pending proposal — NEVER posts to the ledger. Balance is checked here only so the human reviewer sees a sane proposal, not to let this function post it. */
export async function proposeJournalEntry(input: ProposeJournalEntryInput) {
  const debitTotal = input.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const creditTotal = input.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.005) {
    throw new Error("Proposed entry is not balanced — refusing to create the proposal");
  }

  const proposal = await prisma.accountingAiProposal.create({
    data: {
      workspaceUserId: input.workspaceUserId,
      type: "journal_entry",
      payload: JSON.stringify({ lines: input.lines, memo: input.memo }),
      sourceContext: input.sourceContext,
      modelUsed: "manual", // set by the caller when the proposal actually comes from a model call (see route)
    },
  });
  await auditAi(input.workspaceUserId, "proposal_created", "manual", { proposalId: proposal.id, type: "journal_entry" });
  return proposal;
}

/**
 * Suggests an expense's account code (spec ۸ item ۲, simplified — no OCR/
 * receipt image pipeline yet, flagged rather than silently skipped). First
 * tries a deterministic majority vote over this workspace's own prior
 * categorizations of similarly-worded expenses (cheap, explainable, no model
 * call needed); only asks the model when there isn't a clear precedent.
 */
export async function proposeExpenseCategorization(workspaceUserId: string, expenseId: string, requestedBy: string) {
  const expense = await prisma.accountingExpense.findFirstOrThrow({ where: { id: expenseId, workspaceUserId } });
  const words = expense.description.split(/\s+/).filter((w) => w.length > 2);

  const priorExpenses = await prisma.accountingExpense.findMany({
    where: { workspaceUserId, id: { not: expenseId }, status: { in: ["approved", "paid"] } },
    select: { description: true, accountCode: true },
    take: 200,
  });
  const matches = priorExpenses.filter((p) => words.some((w) => p.description.includes(w)));

  let suggestedAccountCode: string;
  let confidence: number;
  let reasoning: string;
  let modelUsed: string;

  if (matches.length >= 3) {
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.accountCode, (counts.get(m.accountCode) || 0) + 1);
    const [topCode, topCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    suggestedAccountCode = topCode;
    confidence = Math.round((topCount / matches.length) * 100) / 100;
    reasoning = `بر اساس ${matches.length} هزینهٔ مشابه قبلی در همین کارگاه، ${topCount} مورد به حساب ${topCode} دسته‌بندی شده‌اند.`;
    modelUsed = "heuristic";
  } else {
    const accounts = await prisma.accountingAccount.findMany({ where: { workspaceUserId, type: "expense" }, select: { code: true, name: true } });
    const list = accounts.map((a) => `${a.code}: ${a.name}`).join("\n");
    const prompt = `شرح هزینه: "${expense.description}"\nمبلغ: ${expense.amount}\n\nحساب‌های هزینهٔ موجود در دفتر حساب‌ها:\n${list}\n\nفقط و فقط کد حساب پیشنهادی را به‌صورت یک عدد بازگردان، هیچ متن دیگری ننویس.`;

    let raw = "";
    let usedProvider: Provider | null = null;
    await routedStreamChat([{ role: "user", content: prompt }], "تو یک دستیار دسته‌بندی هزینه‌های حسابداری هستی.", (t) => { raw += t; }, (p) => { usedProvider = p; }, undefined, undefined, 32);

    const codeMatch = raw.match(/\d{3,4}/);
    suggestedAccountCode = codeMatch ? codeMatch[0] : accounts[0]?.code || "5900";
    confidence = 0.5;
    reasoning = `پیشنهاد مدل هوش مصنوعی بر اساس شرح هزینه، بدون سابقهٔ کافی برای تصمیم قطعی.`;
    modelUsed = (usedProvider as Provider | null)?.id || "unknown";
  }

  const proposal = await prisma.accountingAiProposal.create({
    data: {
      workspaceUserId,
      type: "expense_categorization",
      payload: JSON.stringify({ expenseId, suggestedAccountCode, confidence, reasoning }),
      sourceContext: `expense:${expenseId}`,
      modelUsed,
    },
  });
  await auditAi(workspaceUserId, "proposal_created", modelUsed, { proposalId: proposal.id, type: "expense_categorization", expenseId, requestedBy });
  return proposal;
}

export async function listProposals(workspaceUserId: string, status?: string) {
  return prisma.accountingAiProposal.findMany({ where: { workspaceUserId, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" } });
}

/** The only place a proposal actually takes effect — always a human-triggered call, never the agent itself. */
export async function approveProposal(proposalId: string, workspaceUserId: string, approvedBy: string) {
  const proposal = await prisma.accountingAiProposal.findFirstOrThrow({ where: { id: proposalId, workspaceUserId } });
  if (proposal.status !== "pending") throw new Error("Only a pending proposal can be approved");

  const payload = JSON.parse(proposal.payload);
  if (proposal.type === "journal_entry") {
    await postJournalEntry({
      workspaceUserId,
      postedBy: approvedBy,
      memo: payload.memo,
      sourceRef: `ai_proposal:${proposal.id}`,
      lines: payload.lines,
    });
  } else if (proposal.type === "expense_categorization") {
    await prisma.accountingExpense.update({ where: { id: payload.expenseId }, data: { accountCode: payload.suggestedAccountCode } });
  } else {
    throw new Error(`Unknown proposal type: ${proposal.type}`);
  }

  const updated = await prisma.accountingAiProposal.update({ where: { id: proposalId }, data: { status: "approved", reviewedBy: approvedBy, reviewedAt: new Date() } });
  await auditAi(workspaceUserId, "proposal_approved", proposal.modelUsed, { proposalId, type: proposal.type, approvedBy });
  return updated;
}

export async function rejectProposal(proposalId: string, workspaceUserId: string, rejectedBy: string) {
  const proposal = await prisma.accountingAiProposal.findFirstOrThrow({ where: { id: proposalId, workspaceUserId } });
  if (proposal.status !== "pending") throw new Error("Only a pending proposal can be rejected");
  const updated = await prisma.accountingAiProposal.update({ where: { id: proposalId }, data: { status: "rejected", reviewedBy: rejectedBy, reviewedAt: new Date() } });
  await auditAi(workspaceUserId, "proposal_rejected", proposal.modelUsed, { proposalId, type: proposal.type, rejectedBy });
  return updated;
}
