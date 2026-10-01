export const dynamic = "force-dynamic";

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { rateLimit } from "@/lib/utils/rateLimit";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const groups = await prisma.studentStudyGroup.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true, name: true, inviteCode: true, ownerId: true, createdAt: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const limit = rateLimit(`student-group-create:${user.id}`, 5, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "ساخت گروه بیش از حد مجاز است" }, { status: 429 });
  let body: { name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const name = body.name?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: "نام گروه باید بین ۱ تا ۸۰ نویسه باشد" }, { status: 400 });
  const group = await prisma.studentStudyGroup.create({
    data: { name, ownerId: user.id, inviteCode: randomBytes(24).toString("base64url"), members: { create: { userId: user.id } } },
    select: { id: true, name: true, inviteCode: true, ownerId: true, createdAt: true },
  });
  return NextResponse.json({ group }, { status: 201 });
}
