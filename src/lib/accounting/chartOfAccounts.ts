import { prisma } from "@/lib/db/prisma";

/**
 * Default chart of accounts for a real-estate agency/agent workspace (the
 * spec's explicit example vertical for Phase A) — seeded once per workspace
 * on first use. isSystem:true rows aren't user-deletable, but a workspace
 * can still add its own custom accounts alongside them.
 */
const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; nameEn: string; nameDe: string; type: string }> = [
  // Assets
  { code: "1000", name: "صندوق و بانک", nameEn: "Cash & Bank", nameDe: "Kasse & Bank", type: "asset" },
  { code: "1200", name: "حساب‌های دریافتنی", nameEn: "Accounts Receivable", nameDe: "Forderungen aus Lieferungen und Leistungen", type: "asset" },
  // Liabilities
  { code: "2000", name: "حساب‌های پرداختنی", nameEn: "Accounts Payable", nameDe: "Verbindlichkeiten aus Lieferungen und Leistungen", type: "liability" },
  { code: "2100", name: "کمیسیون پرداختنی به ایجنت", nameEn: "Agent Commission Payable", nameDe: "Verbindlichkeiten aus Maklerprovision", type: "liability" },
  { code: "2200", name: "بدهی به مالک (اجاره کوتاه‌مدت)", nameEn: "Owner Payable (Short-Term Rental)", nameDe: "Verbindlichkeiten gegenüber Eigentümern (Kurzzeitmiete)", type: "liability" },
  // Equity
  { code: "3000", name: "سرمایه صاحبان سهام", nameEn: "Owner's Equity", nameDe: "Eigenkapital", type: "equity" },
  { code: "3900", name: "سود/زیان انباشته", nameEn: "Retained Earnings", nameDe: "Gewinnvortrag/Verlustvortrag", type: "equity" },
  // Revenue
  { code: "4000", name: "درآمد کمیسیون فروش/اجاره", nameEn: "Sales/Rental Commission Revenue", nameDe: "Provisionserlöse aus Verkauf/Vermietung", type: "revenue" },
  { code: "4100", name: "درآمد کارمزد مدیریت اجاره", nameEn: "Rental Management Fee Revenue", nameDe: "Erlöse aus Mietverwaltungsgebühren", type: "revenue" },
  { code: "4900", name: "سایر درآمدها", nameEn: "Other Revenue", nameDe: "Sonstige Erträge", type: "revenue" },
  // Expenses
  { code: "5000", name: "حقوق و کمیسیون ایجنت‌ها", nameEn: "Agent Salaries & Commission", nameDe: "Gehälter und Provisionen der Maklerinnen und Makler", type: "expense" },
  { code: "5100", name: "اجاره دفتر", nameEn: "Office Rent", nameDe: "Büromiete", type: "expense" },
  { code: "5200", name: "تبلیغات و بازاریابی", nameEn: "Advertising & Marketing", nameDe: "Werbung und Marketing", type: "expense" },
  { code: "5300", name: "قبوض و آب‌وبرق", nameEn: "Utilities", nameDe: "Nebenkosten", type: "expense" },
  { code: "5900", name: "سایر هزینه‌های عملیاتی", nameEn: "Other Operating Expenses", nameDe: "Sonstige betriebliche Aufwendungen", type: "expense" },
];

/** Idempotent — safe to call on every accounting page load; only inserts accounts missing for this workspace. */
export async function ensureDefaultChartOfAccounts(workspaceUserId: string): Promise<void> {
  const existing = await prisma.accountingAccount.findMany({
    where: { workspaceUserId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !existingCodes.has(a.code));

  if (missing.length > 0) {
    await prisma.accountingAccount.createMany({
      data: missing.map((a) => ({
        workspaceUserId,
        code: a.code,
        name: a.name,
        nameEn: a.nameEn,
        nameDe: a.nameDe,
        type: a.type,
        isSystem: true,
      })),
    });
  }

  // Backfill German names onto workspaces seeded before nameDe was populated.
  // The column already existed on AccountingAccount but nothing ever wrote it,
  // so a German user read their ledger in English. This only ever fills a NULL
  // on a system account whose code we own — it never touches a name a user
  // edited, never touches custom accounts, and is a no-op once done.
  await backfillGermanNames(workspaceUserId);
}

async function backfillGermanNames(workspaceUserId: string): Promise<void> {
  const needsGerman = await prisma.accountingAccount.findMany({
    where: { workspaceUserId, isSystem: true, nameDe: null },
    select: { id: true, code: true },
  });
  if (needsGerman.length === 0) return;

  const byCode = new Map(DEFAULT_ACCOUNTS.map((a) => [a.code, a.nameDe]));
  await Promise.all(
    needsGerman
      .filter((a) => byCode.has(a.code))
      .map((a) => prisma.accountingAccount.update({ where: { id: a.id }, data: { nameDe: byCode.get(a.code) } })),
  );
}

