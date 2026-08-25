export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, dealAgentFilter } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

const EDITABLE_FIELDS = ["title", "value", "probability", "expectedCloseDate", "ownerId", "lostReason"] as const;
// Section 1, item 5 — Contract & Commission. Row-level visibility ("relevant
// agent + manager only") already comes for free from dealAgentFilter() above
// (an AGENT can only ever fetch their own deals); this only needs an
// additional module gate, not new access-control logic.
const COMMISSION_FIELDS = ["commissionRate", "commissionAmount", "commissionPaymentStatus"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const existing = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    // An AGENT can't reassign a deal to someone else — only MANAGER/OWNER may.
    if (key === "ownerId" && ws.isAgentRestricted) continue;
    if (key in body) data[key] = key === "expectedCloseDate" && body[key] ? new Date(body[key]) : body[key];
  }
  if ("customFields" in body) data.customFields = body.customFields ? JSON.stringify(body.customFields) : null;

  const touchesCommission = COMMISSION_FIELDS.some((k) => k in body);
  if (touchesCommission) {
    const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
    const allowed = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "crm.contractCommission");
    if (!allowed) return NextResponse.json({ error: tri(lang, "ماژول قرارداد و کمیسیون برای شما فعال نیست", "The contract & commission module is not enabled for you", "Das Vertrags- und Provisionsmodul ist für Sie nicht aktiviert") }, { status: 403 });
    for (const key of COMMISSION_FIELDS) {
      if (key in body) data[key] = body[key];
    }
  }

  const deal = await prisma.crmDeal.update({ where: { id: params.id }, data });
  return NextResponse.json({ deal });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();

  const existing = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.crmActivity.deleteMany({ where: { dealId: params.id } });
  await prisma.crmDocument.deleteMany({ where: { dealId: params.id } });
  await prisma.crmDeal.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
