export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { parseBankStatementCsv, importBankTransactions } from "@/lib/accounting/bankReconciliation";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Accepts { bankAccountId, csv } — csv text with date,description,amount columns. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { bankAccountId, csv } = (await req.json()) as { bankAccountId?: string; csv?: string };
  if (!bankAccountId || !csv?.trim()) return NextResponse.json({ error: tri(lang, "حساب بانکی و فایل CSV الزامی است", "Bank account and CSV content are required", "Bankkonto und CSV-Inhalt sind erforderlich") }, { status: 400 });

  try {
    const transactions = parseBankStatementCsv(csv);
    if (transactions.length === 0) return NextResponse.json({ error: tri(lang, "هیچ تراکنش معتبری در فایل یافت نشد", "No valid transactions found in the file", "Keine gültigen Transaktionen in der Datei gefunden") }, { status: 400 });
    const unmatchedCount = await importBankTransactions(ws.workspaceUserId, bankAccountId, transactions);
    return NextResponse.json({ imported: transactions.length, unmatchedCount });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در وارد کردن تراکنش‌ها", "Failed to import transactions", "Fehler beim Importieren der Transaktionen") }, { status: 400 });
  }
}
