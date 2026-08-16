export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const existing = await prisma.voiceKnowledgeBase.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { title, content } = body;

  const updated = await prisma.voiceKnowledgeBase.update({
    where: { id },
    data: {
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      content: typeof content === "string" && content.trim() ? content.trim() : undefined,
    },
  });
  return NextResponse.json({ entry: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const existing = await prisma.voiceKnowledgeBase.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  await prisma.voiceKnowledgeBase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
