export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess, businessFilter } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** Dated history of past CRM Agent pipeline-analysis runs -- see CrmAnalysisRun's doc comment for why this exists. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  // Same manager/owner-only visibility as insights and agent/run.
  if (ws.isAgentRestricted) return NextResponse.json({ runs: [] });

  const runs = await prisma.crmAnalysisRun.findMany({
    where: { userId: ws.workspaceUserId, ...businessFilter(ws) },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, content: true, createdAt: true },
  });

  return NextResponse.json({ runs });
}
