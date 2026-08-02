export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const stageId = searchParams.get("stageId");
  const status = searchParams.get("status");

  const deals = await prisma.crmDeal.findMany({
    where: {
      userId: user.id,
      ...(pipelineId ? { pipelineId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(status ? { status } : {}),
    },
    include: { contact: { select: { id: true, name: true, phone: true, company: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { contactId, pipelineId, stageId, title, value, probability, expectedCloseDate, ownerId, customFields } = body;

  if (!contactId || !pipelineId || !stageId || !title?.trim()) {
    return NextResponse.json({ error: "مخاطب، پایپلاین، مرحله و عنوان الزامی است" }, { status: 400 });
  }

  // Scope every referenced row to this user before allowing the deal to link to it —
  // otherwise a contactId/pipelineId/stageId from another user could be guessed and reused.
  const [contact, pipeline, stage] = await Promise.all([
    prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } }),
    prisma.crmPipeline.findFirst({ where: { id: pipelineId, userId: user.id } }),
    prisma.crmStage.findFirst({ where: { id: stageId, pipelineId } }),
  ]);
  if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  if (!pipeline) return NextResponse.json({ error: "پایپلاین یافت نشد" }, { status: 404 });
  if (!stage) return NextResponse.json({ error: "مرحله یافت نشد" }, { status: 404 });

  const deal = await prisma.crmDeal.create({
    data: {
      userId: user.id,
      contactId,
      pipelineId,
      stageId,
      title: title.trim(),
      value: typeof value === "number" ? value : 0,
      probability: typeof probability === "number" ? probability : 50,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      ownerId: ownerId || undefined,
      customFields: customFields ? JSON.stringify(customFields) : undefined,
    },
  });
  return NextResponse.json({ deal });
}
