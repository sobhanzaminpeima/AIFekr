export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { generateLeadMatcherDrafts } from "@/lib/agents/leadMatcher";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.leadMatcher");
  if (!allowed) return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });

  const lang = await getServerLang();
  try {
    const drafts = await generateLeadMatcherDrafts(ws.workspaceUserId, lang);
    return NextResponse.json({ drafts });
  } catch (err) {
    console.error("Lead Matcher drafts error:", err);
    return NextResponse.json({ error: lang === "fa" ? "خطا در تولید پیشنهادهای تطبیق لید" : "Failed to generate lead-matcher drafts" }, { status: 500 });
  }
}
