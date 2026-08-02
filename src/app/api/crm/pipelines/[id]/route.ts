export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmPipeline.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const { name } = await req.json();
  const pipeline = await prisma.crmPipeline.update({ where: { id: params.id }, data: { name } });
  return NextResponse.json({ pipeline });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmPipeline.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const dealCount = await prisma.crmDeal.count({ where: { pipelineId: params.id } });
  if (dealCount > 0) {
    return NextResponse.json({ error: "این پایپلاین معامله دارد و قابل حذف نیست" }, { status: 400 });
  }

  await prisma.crmStage.deleteMany({ where: { pipelineId: params.id } });
  await prisma.crmPipeline.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
