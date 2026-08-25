export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  // Full-workspace insights are manager/owner visibility, same as agent/run.
  if (ws.isAgentRestricted) return NextResponse.json({ insights: [] });

  const insights = await prisma.crmInsight.findMany({
    where: { userId: ws.workspaceUserId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, category: true, text: true, createdAt: true },
  });

  return NextResponse.json({ insights });
}
