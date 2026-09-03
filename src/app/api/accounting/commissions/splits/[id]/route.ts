export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { payCommissionSplit } from "@/lib/accounting/commission";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Marks one agent's commission split paid — { action: "pay" }. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const split = await prisma.accountingCommissionSplit.findFirst({
    where: { id: params.id, commissionRecord: { workspaceUserId: ws.workspaceUserId } },
  });
  if (!split) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const { action } = (await req.json()) as { action?: string };
  if (action !== "pay") return NextResponse.json({ error: tri(lang, "عملیات نامعتبر است", "Invalid action", "Ungültige Aktion") }, { status: 400 });

  try {
    const updated = await payCommissionSplit(params.id, user.id);
    return NextResponse.json({ split: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در پرداخت کمیسیون", "Failed to pay commission", "Fehler bei der Provisionszahlung") }, { status: 400 });
  }
}
