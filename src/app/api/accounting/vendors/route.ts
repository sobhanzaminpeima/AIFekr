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

  const vendors = await prisma.accountingVendor.findMany({ where: { workspaceUserId: ws.workspaceUserId }, orderBy: { name: "asc" } });
  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const { name, phone, email, notes } = (await req.json()) as { name?: string; phone?: string; email?: string; notes?: string };
  if (!name?.trim()) return NextResponse.json({ error: tri(lang, "نام تأمین‌کننده الزامی است", "Vendor name is required", "Der Name des Lieferanten ist erforderlich") }, { status: 400 });

  const vendor = await prisma.accountingVendor.create({ data: { workspaceUserId: ws.workspaceUserId, name: name.trim(), phone, email, notes } });
  return NextResponse.json({ vendor });
}
