export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { createFiscalPeriod, listFiscalPeriods } from "@/lib/accounting/fiscalPeriod";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const periods = await listFiscalPeriods(ws.workspaceUserId);
  return NextResponse.json({ periods });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { startDate, endDate } = (await req.json()) as { startDate?: string; endDate?: string };
  if (!startDate || !endDate) return NextResponse.json({ error: tri(lang, "تاریخ شروع و پایان الزامی است", "Start and end date are required", "Start- und Enddatum sind erforderlich") }, { status: 400 });

  try {
    const period = await createFiscalPeriod(ws.workspaceUserId, new Date(startDate), new Date(endDate));
    return NextResponse.json({ period });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت دوره مالی", "Failed to create fiscal period", "Fehler beim Erstellen des Geschäftsjahres") }, { status: 400 });
  }
}
