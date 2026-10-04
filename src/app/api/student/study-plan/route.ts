export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { proposeStudySessions } from "@/lib/student/planner";
import { getServerLang } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { examId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body.examId) return NextResponse.json({ error: "ابتدا امتحان مورد نظر برای برنامه را انتخاب کنید" }, { status: 400 });
  const selectedExam = await prisma.studentExam.findFirst({ where: { id: body.examId, userId: user.id, examAt: { gt: new Date() } }, include: { course: { select: { name: true } } } });
  if (!selectedExam) return NextResponse.json({ error: "امتحان پیدا نشد یا در گذشته است" }, { status: 404 });
  const exams = [selectedExam];
  const proposals = proposeStudySessions(exams.map((exam) => ({ id: exam.id, title: exam.title, courseId: exam.courseId, courseName: exam.course.name, examAt: exam.examAt })), new Date(), 7, await getServerLang());
  let created = 0;
  for (const session of proposals) {
    const dayStart = new Date(session.dueAt); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const dedupeKey = `${user.id}:${session.examId}:${session.courseId}:${dayStart.toISOString().slice(0, 10)}`;
    const exists = await prisma.studentTask.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (exists) continue;
    try {
      await prisma.studentTask.create({ data: { userId: user.id, courseId: session.courseId, title: session.title, description: session.description, taskType: "study", dueAt: session.dueAt, generated: true, dedupeKey } });
      created += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  return NextResponse.json({ created, message: created ? "برنامهٔ همین امتحان ساخته شد؛ می‌توانید جلسه‌ها را ویرایش یا حذف کنید" : "برای این امتحان از قبل برنامه دارید؛ جلسه‌های موجود را در فهرست ببینید" });
}
