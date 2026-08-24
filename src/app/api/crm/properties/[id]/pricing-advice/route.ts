export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { generatePricingAdvice } from "@/lib/agents/pricingAdvisor";
import { getServerLang } from "@/lib/i18n/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.pricingAdvisor");
  if (!allowed) return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });

  const lang = await getServerLang();
  try {
    const advice = await generatePricingAdvice(ws.workspaceUserId, params.id, lang);
    if (!advice) return NextResponse.json({ error: lang === "fa" ? "ملک یافت نشد یا تولید پیشنهاد ناموفق بود" : "Property not found or advice generation failed" }, { status: 404 });
    return NextResponse.json(advice);
  } catch (err) {
    console.error("Pricing Advisor error:", err);
    return NextResponse.json({ error: lang === "fa" ? "خطا در تولید پیشنهاد قیمت" : "Failed to generate pricing advice" }, { status: 500 });
  }
}
