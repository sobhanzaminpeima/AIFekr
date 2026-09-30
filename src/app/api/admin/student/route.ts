export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { isStudentWorkspaceEnabled, setStudentWorkspaceEnabled } from "@/lib/student/access";

async function authorize(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin) return { admin, error: null };
  const user = await import("@/lib/auth/middleware").then(({ requireAuth }) => requireAuth(req));
  return { admin: null, error: user ? forbiddenResponse() : unauthorizedResponse() };
}

export async function GET(req: NextRequest) {
  const { admin, error } = await authorize(req);
  if (!admin) return error;
  const [enabled, courses, materials, notes, flashcards, quizzes, attempts, exams, tasks, activeUsers, aiRuns, scores] = await Promise.all([
    isStudentWorkspaceEnabled(),
    prisma.studentCourse.count(), prisma.studentMaterial.count(), prisma.studentNote.count(),
    prisma.studentFlashcard.count(), prisma.studentQuiz.count(), prisma.studentQuizAttempt.count(),
    prisma.studentExam.count(),
    prisma.studentTask.count(),
    prisma.studentCourse.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.usageLog.count({ where: { type: "chat", metadata: { contains: '"feature":"student"' } } }),
    prisma.studentQuizAttempt.aggregate({ _avg: { score: true, total: true } }),
  ]);
  const recentCourses = await prisma.studentCourse.findMany({
    orderBy: { updatedAt: "desc" }, take: 8,
    select: { id: true, name: true, updatedAt: true, user: { select: { id: true, name: true, email: true } }, _count: { select: { materials: true, quizzes: true, notes: true } } },
  });
  return NextResponse.json({ enabled, stats: { activeUsers: activeUsers.length, courses, materials, notes, flashcards, quizzes, attempts, exams, tasks, aiRuns, averageScore: scores._avg.total ? Math.round(((scores._avg.score || 0) / scores._avg.total) * 100) : null }, recentCourses });
}

export async function PATCH(req: NextRequest) {
  const { admin, error } = await authorize(req);
  if (!admin) return error;
  let body: { enabled?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled باید true یا false باشد" }, { status: 400 });
  await setStudentWorkspaceEnabled(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}
