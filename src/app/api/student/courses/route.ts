export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const courses = await prisma.studentCourse.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { materials: true, notes: true, flashcards: true, exams: true, quizzes: true } },
      exams: { where: { examAt: { gte: new Date() } }, orderBy: { examAt: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ courses });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  let body: { name?: string; courseCode?: string; institution?: string; term?: string; instructor?: string; description?: string; color?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if ([body.name, body.courseCode, body.institution, body.term, body.instructor, body.description].some((value) => value !== undefined && typeof value !== "string")) return NextResponse.json({ error: "فیلدهای درس باید متن باشند" }, { status: 400 });
  const name = body.name?.trim();
  if (!name || name.length > 120) return NextResponse.json({ error: "نام درس الزامی است و باید کمتر از ۱۲۰ نویسه باشد" }, { status: 400 });
  if ((body.courseCode?.length || 0) > 40 || (body.institution?.length || 0) > 160 || (body.term?.length || 0) > 80) return NextResponse.json({ error: "اطلاعات درس بیش از حد طولانی است" }, { status: 400 });
  const course = await prisma.studentCourse.create({ data: {
    userId: user.id, name,
    courseCode: body.courseCode?.trim().slice(0, 40) || undefined,
    institution: body.institution?.trim().slice(0, 160) || undefined,
    term: body.term?.trim().slice(0, 80) || undefined,
    instructor: body.instructor?.trim().slice(0, 120) || undefined,
    description: body.description?.trim().slice(0, 2000) || undefined,
    color: /^#[0-9a-f]{6}$/i.test(body.color || "") ? body.color! : "#f97316",
  }, include: {
    _count: { select: { materials: true, notes: true, flashcards: true, exams: true, quizzes: true } },
    exams: { where: { examAt: { gte: new Date() } }, orderBy: { examAt: "asc" }, take: 1 },
  } });
  return NextResponse.json({ course }, { status: 201 });
}
