export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const lessons = await prisma.contentAgentLesson.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ lessons });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { agentKey, text } = await req.json();
  if (!agentKey || !text?.trim()) return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });

  const lesson = await prisma.contentAgentLesson.create({
    data: { userId: user.id, agentKey, text: text.trim(), source: "user" },
  });
  return NextResponse.json({ lesson });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  const lesson = await prisma.contentAgentLesson.findUnique({ where: { id } });
  if (!lesson || lesson.userId !== user.id) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  await prisma.contentAgentLesson.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
