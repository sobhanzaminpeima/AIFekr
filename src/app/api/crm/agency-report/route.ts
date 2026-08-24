export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { generateAgencyReport } from "@/lib/agents/agencyManagerAssistant";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.agencyManager");
  if (!allowed) return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });

  const periodParam = Number(req.nextUrl.searchParams.get("periodDays"));
  const periodDays = Number.isFinite(periodParam) && periodParam > 0 && periodParam <= 90 ? periodParam : 7;
  const lang = await getServerLang();

  try {
    const report = await generateAgencyReport(ws.workspaceUserId, lang, periodDays);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Agency Manager Assistant error:", err);
    return NextResponse.json({ error: lang === "fa" ? "خطا در تولید گزارش" : "Failed to generate report" }, { status: 500 });
  }
}
