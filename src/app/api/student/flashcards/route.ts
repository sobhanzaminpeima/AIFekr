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
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ error: "courseId الزامی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  const flashcards = await prisma.studentFlashcard.findMany({ where: { courseId, userId: user.id }, orderBy: [{ nextReviewAt: "asc" }, { createdAt: "desc" }], take: 200 });
  return NextResponse.json({ flashcards });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  let body: { courseId?: string; question?: string; answer?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (typeof body.courseId !== "string" || typeof body.question !== "string" || typeof body.answer !== "string") return NextResponse.json({ error: "درس، پرسش و پاسخ الزامی است" }, { status: 400 });
  const question = body.question.trim(); const answer = body.answer.trim();
  if (!question || question.length > 1000 || !answer || answer.length > 2000) return NextResponse.json({ error: "پرسش یا پاسخ خالی یا بیش از حد طولانی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: body.courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  const flashcard = await prisma.studentFlashcard.create({ data: { userId: user.id, courseId: course.id, question, answer } });
  return NextResponse.json({ flashcard }, { status: 201 });
}
