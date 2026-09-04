export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { approveProposal, rejectProposal } from "@/lib/agents/financeAgent";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/**
 * { action: "approve" | "reject" } — the only place an AI proposal actually
 * takes effect. Always a human (a logged-in manager/owner), never the agent
 * itself, per spec ۸.۴.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { action } = (await req.json()) as { action?: string };
  try {
    if (action === "approve") return NextResponse.json({ proposal: await approveProposal(params.id, ws.workspaceUserId, user.id) });
    if (action === "reject") return NextResponse.json({ proposal: await rejectProposal(params.id, ws.workspaceUserId, user.id) });
    return NextResponse.json({ error: tri(lang, "اقدام نامعتبر", "Invalid action", "Ungültige Aktion") }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا", "Error", "Fehler") }, { status: 400 });
  }
}
