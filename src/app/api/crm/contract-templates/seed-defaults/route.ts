export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { DEFAULT_CONTRACT_TEMPLATES } from "@/lib/crm/defaultContractTemplates";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Idempotent: only creates templates whose name isn't already present in this workspace, so clicking "restore defaults" repeatedly doesn't pile up duplicates. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند قالب‌های پیش‌فرض را بازیابی کند", "Only a manager or owner can restore the default templates", "Nur ein Manager oder Eigentümer kann die Standardvorlagen wiederherstellen") }, { status: 403 });

  const existing = await prisma.crmContractTemplate.findMany({ where: { userId: ws.workspaceUserId }, select: { name: true } });
  const existingNames = new Set(existing.map((t) => t.name));

  const toCreate = DEFAULT_CONTRACT_TEMPLATES.filter((t) => !existingNames.has(t.name));
  if (toCreate.length === 0) return NextResponse.json({ created: 0, templates: [] });

  await prisma.crmContractTemplate.createMany({
    data: toCreate.map((t) => ({ userId: ws.workspaceUserId, name: t.name, content: t.content, industrySlug: t.industrySlug })),
  });

  const templates = await prisma.crmContractTemplate.findMany({ where: { userId: ws.workspaceUserId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ created: toCreate.length, templates });
}
