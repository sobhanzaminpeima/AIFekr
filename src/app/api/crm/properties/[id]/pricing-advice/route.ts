export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { generatePricingAdvice } from "@/lib/agents/pricingAdvisor";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "agent.pricingAdvisor");
  if (!allowed) return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });

  try {
    const advice = await generatePricingAdvice(ws.workspaceUserId, params.id, lang);
    if (!advice) return NextResponse.json({ error: tri(lang, "ملک یافت نشد یا تولید پیشنهاد ناموفق بود", "Property not found or advice generation failed", "Immobilie nicht gefunden oder Erstellung des Vorschlags fehlgeschlagen") }, { status: 404 });
    return NextResponse.json(advice);
  } catch (err) {
    console.error("Pricing Advisor error:", err);
    return NextResponse.json({ error: tri(lang, "خطا در تولید پیشنهاد قیمت", "Failed to generate pricing advice", "Erstellung des Preisvorschlags fehlgeschlagen") }, { status: 500 });
  }
}
