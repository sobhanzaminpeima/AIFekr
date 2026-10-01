export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isCronAuthorized } from "@/lib/auth/cronAuth";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Idempotent hourly reminder job; only creates in-app notices, never sends email or SMS. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const end = new Date(now.getTime() + WINDOW_MS);
  const [tasks, exams] = await Promise.all([
    prisma.studentTask.findMany({ where: { completedAt: null, dueAt: { gte: now, lt: end } }, select: { id: true, userId: true, title: true, dueAt: true, course: { select: { name: true } } }, take: 500 }),
    prisma.studentExam.findMany({ where: { examAt: { gte: now, lt: end } }, select: { id: true, userId: true, title: true, examAt: true, course: { select: { name: true } } }, take: 500 }),
  ]);
  let created = 0;
  for (const item of tasks) {
    try {
      await prisma.notification.create({ data: { id: `student-task-reminder-${item.id}`, userId: item.userId, type: "student_task_reminder", title: "موعد نزدیک تکلیف", body: `${item.title}${item.course?.name ? ` · ${item.course.name}` : ""}${item.dueAt ? ` · ${item.dueAt.toISOString()}` : ""}`, link: "/student" } });
      created += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  for (const item of exams) {
    try {
      await prisma.notification.create({ data: { id: `student-exam-reminder-${item.id}`, userId: item.userId, type: "student_exam_reminder", title: "امتحان در ۲۴ ساعت آینده", body: `${item.title} · ${item.course.name} · ${item.examAt.toISOString()}`, link: "/student" } });
      created += 1;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
  return NextResponse.json({ created, examined: tasks.length + exams.length });
}
