export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Management fee % for owner statements (spec 3.9 — "درصد قابل‌تنظیم به ازای
 * واحد/مالک"). generateOwnerStatement() has looked this rule up since Phase
 * B (a per-property row overrides the workspace-wide default, which itself
 * defaults to 20% if no rule exists at all), but nothing ever let a real
 * user actually set it -- this was the only way to change it.
 */

/** ?propertyId=... returns that property's effective rule (property-specific, else workspace default, else null meaning the hardcoded 20% applies). Omit propertyId to list every rule in the workspace. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (propertyId) {
    const propertyRule = await prisma.accountingManagementFeeRule.findUnique({ where: { propertyId } });
    const workspaceDefault = await prisma.accountingManagementFeeRule.findFirst({ where: { workspaceUserId: ws.workspaceUserId, propertyId: null } });
    return NextResponse.json({
      feePercent: propertyRule?.feePercent ?? workspaceDefault?.feePercent ?? 20,
      source: propertyRule ? "property" : workspaceDefault ? "workspace_default" : "hardcoded_default",
    });
  }

  const rules = await prisma.accountingManagementFeeRule.findMany({ where: { workspaceUserId: ws.workspaceUserId } });
  return NextResponse.json({ rules });
}

/** { propertyId?: string, feePercent: number } — propertyId omitted/null sets the workspace-wide default instead of a specific unit. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { propertyId, feePercent } = (await req.json()) as { propertyId?: string | null; feePercent?: number };
  if (typeof feePercent !== "number" || feePercent < 0 || feePercent > 100) {
    return NextResponse.json({ error: tri(lang, "درصد کارمزد باید بین ۰ تا ۱۰۰ باشد", "Fee percent must be between 0 and 100", "Der Gebührenprozentsatz muss zwischen 0 und 100 liegen") }, { status: 400 });
  }

  if (propertyId) {
    const property = await prisma.property.findFirst({ where: { id: propertyId, userId: ws.workspaceUserId } });
    if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });
  }

  // propertyId is @unique but nullable -- a plain upsert-by-propertyId only
  // works for the non-null case, so the workspace-default row (propertyId:
  // null) is found/updated manually instead.
  let rule;
  if (propertyId) {
    rule = await prisma.accountingManagementFeeRule.upsert({
      where: { propertyId },
      update: { feePercent },
      create: { workspaceUserId: ws.workspaceUserId, propertyId, feePercent },
    });
  } else {
    const existing = await prisma.accountingManagementFeeRule.findFirst({ where: { workspaceUserId: ws.workspaceUserId, propertyId: null } });
    rule = existing
      ? await prisma.accountingManagementFeeRule.update({ where: { id: existing.id }, data: { feePercent } })
      : await prisma.accountingManagementFeeRule.create({ data: { workspaceUserId: ws.workspaceUserId, propertyId: null, feePercent } });
  }

  return NextResponse.json({ rule });
}
