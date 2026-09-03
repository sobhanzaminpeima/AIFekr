export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { createCommissionRecord } from "@/lib/accounting/commission";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const records = await prisma.accountingCommissionRecord.findMany({
    where: { workspaceUserId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { splits: { some: { agentUserId: ws.actingUserId } } } : {}) },
    include: { splits: true, deal: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { dealId, totalAmount, splits } = (await req.json()) as {
    dealId?: string; totalAmount?: number; splits?: { agentUserId: string; percent: number }[];
  };
  if (!dealId || typeof totalAmount !== "number" || totalAmount <= 0 || !Array.isArray(splits) || splits.length === 0) {
    return NextResponse.json({ error: tri(lang, "معامله، مبلغ کل و حداقل یک ایجنت الزامی است", "Deal, total amount, and at least one agent split are required", "Deal, Gesamtbetrag und mindestens ein Agentenanteil sind erforderlich") }, { status: 400 });
  }

  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId } });
  if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });

  try {
    await ensureDefaultChartOfAccounts(ws.workspaceUserId);
    const record = await createCommissionRecord(ws.workspaceUserId, dealId, totalAmount, splits);
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ثبت کمیسیون", "Failed to create commission record", "Fehler beim Erstellen der Provision") }, { status: 400 });
  }
}
