export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess, dealAgentFilter } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; productLinkId: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const deal = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });

  const dealProduct = await prisma.crmDealProduct.findFirst({ where: { id: params.productLinkId, dealId: deal.id } });
  if (!dealProduct) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.crmDealProduct.delete({ where: { id: dealProduct.id } });
  return NextResponse.json({ success: true });
}
