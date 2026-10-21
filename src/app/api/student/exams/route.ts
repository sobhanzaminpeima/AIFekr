export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const exams = await prisma.studentExam.findMany({ where: { userId: user.id }, include: { course: { select: { id: true, name: true, color: true } } }, orderBy: { examAt: "asc" }, take: 100 });
  return NextResponse.json({ exams });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { courseId?: string; title?: string; examAt?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  const examAt = body.examAt ? new Date(body.examAt) : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (typeof body.courseId !== "string" || !body.courseId || typeof body.examAt !== "string" || !title || title.length > 200 || !examAt || Number.isNaN(examAt.getTime())) return NextResponse.json({ error: "درس، عنوان و تاریخ معتبر الزامی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: body.courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  const exam = await prisma.studentExam.create({ data: { userId: user.id, courseId: body.courseId, title, examAt } });
  return NextResponse.json({ exam }, { status: 201 });
}
