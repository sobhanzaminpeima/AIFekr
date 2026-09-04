export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { findMatchCandidates, confirmMatch, ignoreTransaction } from "@/lib/accounting/bankReconciliation";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** GET returns match candidates for this unmatched transaction. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const txn = await prisma.accountingBankTransaction.findFirst({ where: { id: params.id, workspaceUserId: ws.workspaceUserId } });
  if (!txn) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const candidates = await findMatchCandidates(ws.workspaceUserId, params.id);
  return NextResponse.json({ candidates });
}

/** { action: "match", matchedType, matchedId } or { action: "ignore" } — the final choice is always the user's. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const existing = await prisma.accountingBankTransaction.findFirst({ where: { id: params.id, workspaceUserId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const body = (await req.json()) as { action?: string; matchedType?: "expense" | "invoice"; matchedId?: string };

  try {
    if (body.action === "match") {
      if (!body.matchedType || !body.matchedId) return NextResponse.json({ error: tri(lang, "نوع و شناسه رکورد تطبیق‌شده الزامی است", "matchedType and matchedId are required", "matchedType und matchedId sind erforderlich") }, { status: 400 });
      const txn = await confirmMatch(params.id, body.matchedType, body.matchedId, user.id);
      return NextResponse.json({ transaction: txn });
    }
    if (body.action === "ignore") {
      const txn = await ignoreTransaction(params.id, user.id);
      return NextResponse.json({ transaction: txn });
    }
    return NextResponse.json({ error: tri(lang, "عملیات نامعتبر است", "Invalid action", "Ungültige Aktion") }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در به‌روزرسانی تراکنش", "Failed to update transaction", "Fehler beim Aktualisieren der Transaktion") }, { status: 400 });
  }
}
