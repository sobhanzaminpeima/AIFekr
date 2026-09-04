export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { listProposals, proposeExpenseCategorization } from "@/lib/agents/financeAgent";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const proposals = await listProposals(ws.workspaceUserId, status);
  return NextResponse.json({ proposals });
}

/** Asks the agent to propose an account code for one expense (spec ۸ item ۲). Only ever creates a pending proposal — never changes the expense itself. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { expenseId } = (await req.json()) as { expenseId?: string };
  if (!expenseId) return NextResponse.json({ error: tri(lang, "شناسه هزینه الزامی است", "expenseId is required", "expenseId ist erforderlich") }, { status: 400 });

  try {
    const proposal = await proposeExpenseCategorization(ws.workspaceUserId, expenseId, user.id);
    return NextResponse.json({ proposal });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت پیشنهاد", "Failed to create proposal", "Fehler beim Erstellen des Vorschlags") }, { status: 400 });
  }
}
