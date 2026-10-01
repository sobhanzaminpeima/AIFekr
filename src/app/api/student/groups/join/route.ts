export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { rateLimit } from "@/lib/utils/rateLimit";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-group-join:${user.id}`, 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "تعداد تلاش برای عضویت بیش از حد مجاز است" }, { status: 429 });
  let body: { inviteCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const inviteCode = body.inviteCode?.trim();
  if (!inviteCode || inviteCode.length > 64) return NextResponse.json({ error: "کد دعوت معتبر نیست" }, { status: 400 });
  const group = await prisma.studentStudyGroup.findUnique({ where: { inviteCode }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "گروه یا کد دعوت پیدا نشد" }, { status: 404 });
  await prisma.studentStudyGroupMember.upsert({ where: { groupId_userId: { groupId: group.id, userId: user.id } }, create: { groupId: group.id, userId: user.id }, update: {} });
  return NextResponse.json({ joined: true, groupId: group.id });
}
