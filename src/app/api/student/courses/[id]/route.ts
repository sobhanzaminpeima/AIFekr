export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const course = await prisma.studentCourse.findFirst({
    where: { id: context.params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { name?: string; courseCode?: string | null; institution?: string | null; term?: string | null; instructor?: string | null; description?: string | null; color?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  const data: Record<string, string | null> = {};
  const limits: Record<string, number> = { name: 120, courseCode: 40, institution: 160, term: 80, instructor: 120, description: 2000 };
  for (const key of Object.keys(limits)) {
    const value = body[key as keyof typeof body];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") return NextResponse.json({ error: "اطلاعات درس معتبر نیست" }, { status: 400 });
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized.length > limits[key] || (key === "name" && !normalized)) return NextResponse.json({ error: "یکی از فیلدها خالی یا بیش از حد طولانی است" }, { status: 400 });
    data[key] = normalized || null;
  }
  if (body.color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(body.color)) return NextResponse.json({ error: "رنگ معتبر نیست" }, { status: 400 });
    data.color = body.color;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "تغییری برای ذخیره ارسال نشده است" }, { status: 400 });
  const updated = await prisma.studentCourse.updateMany({ where: { id: context.params.id, userId: user.id }, data });
  if (!updated.count) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  const course = await prisma.studentCourse.findFirst({ where: { id: context.params.id, userId: user.id }, include: { _count: { select: { materials: true, notes: true, flashcards: true, exams: true, quizzes: true } }, exams: { where: { examAt: { gte: new Date() } }, orderBy: { examAt: "asc" }, take: 1 } } });
  return NextResponse.json({ course });
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const deleted = await prisma.studentCourse.deleteMany({ where: { id: context.params.id, userId: user.id } });
  if (!deleted.count) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}
