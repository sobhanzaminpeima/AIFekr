import { prisma } from "@/lib/db/prisma";

/**
 * Default chart of accounts for a real-estate agency/agent workspace (the
 * spec's explicit example vertical for Phase A) — seeded once per workspace
 * on first use. isSystem:true rows aren't user-deletable, but a workspace
 * can still add its own custom accounts alongside them.
 */
const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; nameEn: string; nameDe: string; nameTr: string; type: string }> = [
  // Assets
  { code: "1000", name: "صندوق و بانک", nameEn: "Cash & Bank", nameDe: "Kasse & Bank", nameTr: "Kasa ve Banka", type: "asset" },
  { code: "1200", name: "حساب‌های دریافتنی", nameEn: "Accounts Receivable", nameDe: "Forderungen aus Lieferungen und Leistungen", nameTr: "Alacak Hesapları", type: "asset" },
  // Liabilities
  { code: "2000", name: "حساب‌های پرداختنی", nameEn: "Accounts Payable", nameDe: "Verbindlichkeiten aus Lieferungen und Leistungen", nameTr: "Borç Hesapları", type: "liability" },
  { code: "2100", name: "کمیسیون پرداختنی به ایجنت", nameEn: "Agent Commission Payable", nameDe: "Verbindlichkeiten aus Maklerprovision", nameTr: "Ödenecek Ajan Komisyonu", type: "liability" },
  { code: "2200", name: "بدهی به مالک (اجاره کوتاه‌مدت)", nameEn: "Owner Payable (Short-Term Rental)", nameDe: "Verbindlichkeiten gegenüber Eigentümern (Kurzzeitmiete)", nameTr: "Mal Sahibine Borç (Kısa Vadeli Kiralama)", type: "liability" },
  // Equity
  { code: "3000", name: "سرمایه صاحبان سهام", nameEn: "Owner's Equity", nameDe: "Eigenkapital", nameTr: "Öz Sermaye", type: "equity" },
  { code: "3900", name: "سود/زیان انباشته", nameEn: "Retained Earnings", nameDe: "Gewinnvortrag/Verlustvortrag", nameTr: "Birikmiş Kâr/Zarar", type: "equity" },
  // Revenue
  { code: "4000", name: "درآمد کمیسیون فروش/اجاره", nameEn: "Sales/Rental Commission Revenue", nameDe: "Provisionserlöse aus Verkauf/Vermietung", nameTr: "Satış/Kiralama Komisyon Geliri", type: "revenue" },
  { code: "4100", name: "درآمد کارمزد مدیریت اجاره", nameEn: "Rental Management Fee Revenue", nameDe: "Erlöse aus Mietverwaltungsgebühren", nameTr: "Kiralama Yönetim Ücreti Geliri", type: "revenue" },
  { code: "4900", name: "سایر درآمدها", nameEn: "Other Revenue", nameDe: "Sonstige Erträge", nameTr: "Diğer Gelirler", type: "revenue" },
  // Expenses
  { code: "5000", name: "حقوق و کمیسیون ایجنت‌ها", nameEn: "Agent Salaries & Commission", nameDe: "Gehälter und Provisionen der Maklerinnen und Makler", nameTr: "Ajan Maaşları ve Komisyonları", type: "expense" },
  { code: "5100", name: "اجاره دفتر", nameEn: "Office Rent", nameDe: "Büromiete", nameTr: "Ofis Kirası", type: "expense" },
  { code: "5200", name: "تبلیغات و بازاریابی", nameEn: "Advertising & Marketing", nameDe: "Werbung und Marketing", nameTr: "Reklam ve Pazarlama", type: "expense" },
  { code: "5300", name: "قبوض و آب‌وبرق", nameEn: "Utilities", nameDe: "Nebenkosten", nameTr: "Faturalar", type: "expense" },
  { code: "5900", name: "سایر هزینه‌های عملیاتی", nameEn: "Other Operating Expenses", nameDe: "Sonstige betriebliche Aufwendungen", nameTr: "Diğer İşletme Giderleri", type: "expense" },
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
        nameTr: a.nameTr,
        type: a.type,
        isSystem: true,
      })),
    });
  }

  // Backfill German/Turkish names onto workspaces seeded before those columns
  // were populated. The columns already existed on AccountingAccount but
  // nothing ever wrote them, so a German/Turkish user read their ledger in
  // English or Persian. This only ever fills a NULL on a system account whose
  // code we own — it never touches a name a user edited, never touches custom
  // accounts, and is a no-op once done.
  await backfillLocalizedNames(workspaceUserId, "nameDe");
  await backfillLocalizedNames(workspaceUserId, "nameTr");
}

async function backfillLocalizedNames(workspaceUserId: string, field: "nameDe" | "nameTr"): Promise<void> {
  const needsBackfill = await prisma.accountingAccount.findMany({
    where: { workspaceUserId, isSystem: true, [field]: null },
    select: { id: true, code: true },
  });
  if (needsBackfill.length === 0) return;

  const byCode = new Map(DEFAULT_ACCOUNTS.map((a) => [a.code, a[field]]));
  await Promise.all(
    needsBackfill
      .filter((a) => byCode.has(a.code))
      .map((a) => prisma.accountingAccount.update({ where: { id: a.id }, data: { [field]: byCode.get(a.code) } })),
  );
}

