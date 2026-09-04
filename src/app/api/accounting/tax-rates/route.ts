export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const taxRates = await prisma.accountingTaxRate.findMany({ where: { workspaceUserId: ws.workspaceUserId }, orderBy: { ratePercent: "asc" } });
  return NextResponse.json({ taxRates });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { name, ratePercent, isDefault } = (await req.json()) as { name?: string; ratePercent?: number; isDefault?: boolean };
  if (!name?.trim() || typeof ratePercent !== "number" || ratePercent < 0) {
    return NextResponse.json({ error: tri(lang, "نام و درصد نرخ مالیات الزامی است", "Name and a valid tax rate percentage are required", "Name und ein gültiger Steuersatz sind erforderlich") }, { status: 400 });
  }

  if (isDefault) {
    await prisma.accountingTaxRate.updateMany({ where: { workspaceUserId: ws.workspaceUserId, isDefault: true }, data: { isDefault: false } });
  }
  const taxRate = await prisma.accountingTaxRate.create({ data: { workspaceUserId: ws.workspaceUserId, name: name.trim(), ratePercent, isDefault: !!isDefault } });
  return NextResponse.json({ taxRate });
}
