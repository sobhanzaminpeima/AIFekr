export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { rateLimit } from "@/lib/utils/rateLimit";

type Context = { params: { id: string } };
async function isMember(groupId: string, userId: string) {
  return prisma.studentStudyGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { id: true } });
}

export async function GET(req: NextRequest, { params }: Context) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  if (!await isMember(params.id, user.id)) return NextResponse.json({ error: "به این گروه دسترسی ندارید" }, { status: 404 });
  const messages = await prisma.studentStudyGroupMessage.findMany({ where: { groupId: params.id }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { id: true, name: true } } } });
  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: NextRequest, { params }: Context) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-group-message:${user.id}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "تعداد پیام‌ها بیش از حد مجاز است" }, { status: 429 });
  if (!await isMember(params.id, user.id)) return NextResponse.json({ error: "به این گروه دسترسی ندارید" }, { status: 404 });
  let body: { content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const content = body.content?.trim();
  if (!content || content.length > 2000) return NextResponse.json({ error: "متن پیام باید بین ۱ تا ۲۰۰۰ نویسه باشد" }, { status: 400 });
  const message = await prisma.studentStudyGroupMessage.create({ data: { groupId: params.id, userId: user.id, content }, include: { user: { select: { id: true, name: true } } } });
  return NextResponse.json({ message }, { status: 201 });
}
