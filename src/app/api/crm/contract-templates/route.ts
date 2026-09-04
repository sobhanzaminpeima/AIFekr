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

  const templates = await prisma.crmContractTemplate.findMany({
    where: { userId: ws.workspaceUserId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const body = await req.json();
  const { name, content, industrySlug } = body;
  if (!name?.trim() || !content?.trim()) return NextResponse.json({ error: tri(lang, "نام و متن قالب الزامی است", "Template name and content are required", "Vorlagenname und Inhalt sind erforderlich") }, { status: 400 });

  const template = await prisma.crmContractTemplate.create({
    data: { userId: ws.workspaceUserId, name: name.trim(), content, industrySlug: industrySlug || undefined },
  });
  return NextResponse.json({ template });
}
