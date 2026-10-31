export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess, businessFilter } from "@/lib/crm/workspace";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { postJournalEntry } from "@/lib/accounting/ledger";
import { ledgerErrorMessage } from "@/lib/accounting/ledgerErrors";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** The workspace's journal entries, newest first, with their lines and account codes. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const entries = await prisma.accountingJournalEntry.findMany({
    where: { workspaceUserId: ws.workspaceUserId, ...businessFilter(ws) },
    include: { lines: { include: { account: { select: { code: true, name: true, nameEn: true, nameDe: true, nameTr: true } } } } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ entries });
}

/**
 * Posts a manual journal entry. Everything that keeps the books sound — the
 * balance check, locked periods, accounts of this workspace only, the audit
 * log — is postJournalEntry()'s, the ledger's only write path.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (req.headers.get("origin") !== (process.env.NODE_ENV === "production" ? "https://aifekr.com" : `${req.nextUrl.protocol}//${req.headers.get("host") || req.nextUrl.host}`)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { memo, entryDate, lines } = body as { memo?: string; entryDate?: string; lines?: { accountCode?: string; debit?: number; credit?: number; memo?: string }[] };
  const date = entryDate ? new Date(entryDate) : new Date();
  if (!memo?.trim() || !Array.isArray(lines) || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: tri(lang, "تاریخ، شرح و ردیف‌های سند الزامی است", "Date, memo and entry lines are required", "Datum, Beschreibung und Buchungszeilen sind erforderlich", "Tarih, açıklama ve kayıt satırları gereklidir") }, { status: 400 });
  }

  try {
    await ensureDefaultChartOfAccounts(ws.workspaceUserId, ws.businessId);
    const entry = await postJournalEntry({
      workspaceUserId: ws.workspaceUserId,
      businessId: ws.businessId,
      postedBy: user.id,
      memo: memo.trim().slice(0, 500),
      entryDate: date,
      lines: lines.map((l) => ({ accountCode: String(l.accountCode ?? ""), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo?.trim() ? l.memo.trim().slice(0, 300) : undefined })),
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: ledgerErrorMessage(err, lang) }, { status: 400 });
  }
}
