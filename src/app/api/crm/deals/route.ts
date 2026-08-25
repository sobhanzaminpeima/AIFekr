export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, dealAgentFilter } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const stageId = searchParams.get("stageId");
  const status = searchParams.get("status");

  const deals = await prisma.crmDeal.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(pipelineId ? { pipelineId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(status ? { status } : {}),
      ...dealAgentFilter(ws),
    },
    include: { contact: { select: { id: true, name: true, phone: true, company: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  // Defense in depth beyond the write-side gate in [id]/route.ts — a
  // customer without the module strips these fields from the payload
  // entirely, not just hides them in the UI.
  const owner = await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } });
  const commissionEnabled = await isModuleEnabled({ id: user.id, role: user.role, industryPackId: owner?.industryPackId ?? null }, "crm.contractCommission");
  const payload = commissionEnabled
    ? deals
    : deals.map(({ commissionRate: _cr, commissionAmount: _ca, commissionPaymentStatus: _cs, ...rest }) => rest);

  return NextResponse.json({ deals: payload });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const lang = await getServerLang();
  const body = await req.json();
  const { contactId, pipelineId, stageId, title, value, probability, expectedCloseDate, ownerId, customFields } = body;

  if (!contactId || !pipelineId || !stageId || !title?.trim()) {
    return NextResponse.json({ error: tri(lang, "مخاطب، پایپلاین، مرحله و عنوان الزامی است", "Contact, pipeline, stage, and title are required", "Kontakt, Pipeline, Phase und Titel sind erforderlich") }, { status: 400 });
  }

  // Scope every referenced row to this workspace before allowing the deal to link to it —
  // otherwise a contactId/pipelineId/stageId from another user could be guessed and reused.
  // An AGENT may only create a deal against a contact already assigned to them.
  const [contact, pipeline, stage] = await Promise.all([
    prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } }),
    prisma.crmPipeline.findFirst({ where: { id: pipelineId, userId: ws.workspaceUserId } }),
    prisma.crmStage.findFirst({ where: { id: stageId, pipelineId } }),
  ]);
  if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب یافت نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });
  if (!pipeline) return NextResponse.json({ error: tri(lang, "پایپلاین یافت نشد", "Pipeline not found", "Pipeline nicht gefunden") }, { status: 404 });
  if (!stage) return NextResponse.json({ error: tri(lang, "مرحله یافت نشد", "Stage not found", "Phase nicht gefunden") }, { status: 404 });

  const deal = await prisma.crmDeal.create({
    data: {
      userId: ws.workspaceUserId,
      contactId,
      pipelineId,
      stageId,
      title: title.trim(),
      value: typeof value === "number" ? value : 0,
      probability: typeof probability === "number" ? probability : 50,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      ownerId: ws.isAgentRestricted ? ws.actingUserId : ownerId || undefined,
      customFields: customFields ? JSON.stringify(customFields) : undefined,
    },
  });
  return NextResponse.json({ deal });
}
