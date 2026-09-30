export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { proposeStudySessions } from "@/lib/student/planner";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse();
  if (unavailable) return unavailable;
  const exams = await prisma.studentExam.findMany({
    where: { userId: user.id, examAt: { gt: new Date() } },
    include: { course: { select: { name: true } } }, orderBy: { examAt: "asc" }, take: 12,
  });
  if (!exams.length) return NextResponse.json({ created: 0, message: "برای ساخت برنامه ابتدا تاریخ یک امتحان آینده را ثبت کنید" });
  const proposals = proposeStudySessions(exams.map((exam) => ({ id: exam.id, title: exam.title, courseId: exam.courseId, courseName: exam.course.name, examAt: exam.examAt })));
  let created = 0;
  for (const session of proposals) {
    const dayStart = new Date(session.dueAt); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const dedupeKey = `${user.id}:${session.courseId}:${dayStart.toISOString().slice(0, 10)}`;
    const exists = await prisma.studentTask.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (exists) continue;
    try {
      await prisma.studentTask.create({ data: { userId: user.id, courseId: session.courseId, title: session.title, description: session.description, taskType: "study", dueAt: session.dueAt, generated: true, dedupeKey } });
      created += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  return NextResponse.json({ created, message: "برنامه پیشنهادی بر اساس تاریخ امتحان ساخته شد؛ می‌توانید جلسه‌ها را ویرایش یا حذف کنید" });
}
