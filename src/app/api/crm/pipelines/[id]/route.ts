export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند پایپلاین را ویرایش کند", "Only a manager or owner can edit a pipeline", "Nur ein Manager oder Inhaber kann eine Pipeline bearbeiten") }, { status: 403 });

  const existing = await prisma.crmPipeline.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const { name } = await req.json();
  const pipeline = await prisma.crmPipeline.update({ where: { id: params.id }, data: { name } });
  return NextResponse.json({ pipeline });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند پایپلاین را حذف کند", "Only a manager or owner can delete a pipeline", "Nur ein Manager oder Inhaber kann eine Pipeline löschen") }, { status: 403 });

  const existing = await prisma.crmPipeline.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const dealCount = await prisma.crmDeal.count({ where: { pipelineId: params.id } });
  if (dealCount > 0) {
    return NextResponse.json({ error: tri(lang, "این پایپلاین معامله دارد و قابل حذف نیست", "This pipeline has deals and cannot be deleted", "Diese Pipeline enthält Deals und kann nicht gelöscht werden") }, { status: 400 });
  }

  await prisma.crmStage.deleteMany({ where: { pipelineId: params.id } });
  await prisma.crmPipeline.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
