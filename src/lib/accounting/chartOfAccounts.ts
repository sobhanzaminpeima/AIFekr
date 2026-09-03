import { prisma } from "@/lib/db/prisma";

/**
 * Default chart of accounts for a real-estate agency/agent workspace (the
 * spec's explicit example vertical for Phase A) — seeded once per workspace
 * on first use. isSystem:true rows aren't user-deletable, but a workspace
 * can still add its own custom accounts alongside them.
 */
const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; nameEn: string; type: string }> = [
  // Assets
  { code: "1000", name: "صندوق و بانک", nameEn: "Cash & Bank", type: "asset" },
  { code: "1200", name: "حساب‌های دریافتنی", nameEn: "Accounts Receivable", type: "asset" },
  // Liabilities
  { code: "2000", name: "حساب‌های پرداختنی", nameEn: "Accounts Payable", type: "liability" },
  { code: "2100", name: "کمیسیون پرداختنی به ایجنت", nameEn: "Agent Commission Payable", type: "liability" },
  { code: "2200", name: "بدهی به مالک (اجاره کوتاه‌مدت)", nameEn: "Owner Payable (Short-Term Rental)", type: "liability" },
  // Equity
  { code: "3000", name: "سرمایه صاحبان سهام", nameEn: "Owner's Equity", type: "equity" },
  { code: "3900", name: "سود/زیان انباشته", nameEn: "Retained Earnings", type: "equity" },
  // Revenue
  { code: "4000", name: "درآمد کمیسیون فروش/اجاره", nameEn: "Sales/Rental Commission Revenue", type: "revenue" },
  { code: "4100", name: "درآمد کارمزد مدیریت اجاره", nameEn: "Rental Management Fee Revenue", type: "revenue" },
  { code: "4900", name: "سایر درآمدها", nameEn: "Other Revenue", type: "revenue" },
  // Expenses
  { code: "5000", name: "حقوق و کمیسیون ایجنت‌ها", nameEn: "Agent Salaries & Commission", type: "expense" },
  { code: "5100", name: "اجاره دفتر", nameEn: "Office Rent", type: "expense" },
  { code: "5200", name: "تبلیغات و بازاریابی", nameEn: "Advertising & Marketing", type: "expense" },
  { code: "5300", name: "قبوض و آب‌وبرق", nameEn: "Utilities", type: "expense" },
  { code: "5900", name: "سایر هزینه‌های عملیاتی", nameEn: "Other Operating Expenses", type: "expense" },
];

/** Idempotent — safe to call on every accounting page load; only inserts accounts missing for this workspace. */
export async function ensureDefaultChartOfAccounts(workspaceUserId: string): Promise<void> {
  const existing = await prisma.accountingAccount.findMany({
    where: { workspaceUserId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !existingCodes.has(a.code));
  if (missing.length === 0) return;

  await prisma.accountingAccount.createMany({
    data: missing.map((a) => ({
      workspaceUserId,
      code: a.code,
      name: a.name,
      nameEn: a.nameEn,
      type: a.type,
      isSystem: true,
    })),
  });
}
