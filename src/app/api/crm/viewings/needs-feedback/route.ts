export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { listFeedbackNeeded } from "@/lib/agents/viewingCoordinator";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.viewingCoordinator");
  if (!allowed) return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });

  const viewings = await listFeedbackNeeded(ws.workspaceUserId, ws.isAgentRestricted ? ws.actingUserId : undefined);
  return NextResponse.json({ viewings });
}
