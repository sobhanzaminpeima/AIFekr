export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { suggestOwnerStatementLines } from "@/lib/agents/financeAgent";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { reserveToolCredits } from "@/lib/utils/toolCredits";

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

  // Only the free-text notes go through a model. Filling from bookings and tracked expenses is rule-based
  // (and runs automatically when the unit/month changes), so it stays free; a model call is billed.
  const usesModel = !!notes?.trim();
  const gate = usesModel ? await reserveToolCredits(user.id, "accounting.owner-statement-assist") : null;
  if (gate && !gate.ok) return gate.response;

  try {
    const lines = await suggestOwnerStatementLines(ws.workspaceUserId, propertyId, new Date(month), notes, ws.businessId);
    return NextResponse.json({ lines });
  } catch (err) {
    await gate?.release();
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت پیشنهاد", "Failed to generate suggestions", "Fehler beim Erstellen der Vorschläge") }, { status: 400 });
  }
}
