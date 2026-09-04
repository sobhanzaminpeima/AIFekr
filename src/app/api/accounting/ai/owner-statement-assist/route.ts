export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { suggestOwnerStatementLines } from "@/lib/agents/financeAgent";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/**
 * Owner Statement Assistant (spec ۸ item ۵). Never creates the statement
 * itself — returns suggested line items for a human to review/edit before
 * calling POST /api/accounting/owner-statements (Phase B) as usual.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { propertyId, month, notes } = (await req.json()) as { propertyId?: string; month?: string; notes?: string };
  if (!propertyId || !month) {
    return NextResponse.json({ error: tri(lang, "ملک و ماه الزامی است", "Property and month are required", "Immobilie und Monat sind erforderlich") }, { status: 400 });
  }

  try {
    const lines = await suggestOwnerStatementLines(ws.workspaceUserId, propertyId, new Date(month), notes);
    return NextResponse.json({ lines });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت پیشنهاد", "Failed to generate suggestions", "Fehler beim Erstellen der Vorschläge") }, { status: 400 });
  }
}
