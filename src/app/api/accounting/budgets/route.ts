export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { setBudget, getBudgetVsActual } from "@/lib/accounting/budget";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const periodParam = req.nextUrl.searchParams.get("period");
  const period = periodParam ? new Date(periodParam) : new Date();
  const rows = await getBudgetVsActual(ws.workspaceUserId, period);
  return NextResponse.json({ rows });
}

/** { accountCode, period, amount } — upserts one budget line for a month. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { accountCode, period, amount } = (await req.json()) as { accountCode?: string; period?: string; amount?: number };
  if (!accountCode || !period || typeof amount !== "number") {
    return NextResponse.json({ error: tri(lang, "کد حساب، دوره و مبلغ الزامی است", "Account code, period, and amount are required", "Kontocode, Zeitraum und Betrag sind erforderlich") }, { status: 400 });
  }

  const budget = await setBudget(ws.workspaceUserId, accountCode, new Date(period), amount);
  return NextResponse.json({ budget });
}
