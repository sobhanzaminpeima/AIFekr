export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  const entries = await prisma.voiceKnowledgeBase.findMany({
    where: { userId: user.id, ...(agentId ? { agentId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { title, content, agentId } = body;
  if (!title?.trim()) return NextResponse.json({ error: "عنوان الزامی است" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "محتوا الزامی است" }, { status: 400 });

  if (agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) return NextResponse.json({ error: "ایجنت نامعتبر است" }, { status: 400 });
  }

  const entry = await prisma.voiceKnowledgeBase.create({
    data: { userId: user.id, agentId: agentId || undefined, title: title.trim(), content: content.trim() },
  });
  return NextResponse.json({ entry });
}
