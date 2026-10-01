export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { isStudentWorkspaceEnabled, setStudentWorkspaceEnabled } from "@/lib/student/access";
import { getThesisAssistCreditCost, setThesisAssistCreditCost } from "@/lib/student/costs";

async function authorize(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin) return { admin, error: null };
  const user = await import("@/lib/auth/middleware").then(({ requireAuth }) => requireAuth(req));
  return { admin: null, error: user ? forbiddenResponse() : unauthorizedResponse() };
}

export async function GET(req: NextRequest) {
  const { admin, error } = await authorize(req);
  if (!admin) return error;
  const [enabled, thesisAssistCreditCost, courses, materials, notes, flashcards, quizzes, attempts, exams, tasks, activeUsers, aiRuns, aiCredits, scores] = await Promise.all([
    isStudentWorkspaceEnabled(),
    getThesisAssistCreditCost(),
    prisma.studentCourse.count(), prisma.studentMaterial.count(), prisma.studentNote.count(),
    prisma.studentFlashcard.count(), prisma.studentQuiz.count(), prisma.studentQuizAttempt.count(),
    prisma.studentExam.count(),
    prisma.studentTask.count(),
    prisma.studentCourse.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.usageLog.count({ where: { type: "chat", metadata: { contains: '"feature":"student"' } } }),
    prisma.usageLog.aggregate({ where: { type: "chat", metadata: { contains: '"feature":"student"' } }, _sum: { credits: true } }),
    prisma.studentQuizAttempt.aggregate({ _avg: { score: true, total: true } }),
  ]);
  const recentCourses = await prisma.studentCourse.findMany({
    orderBy: { updatedAt: "desc" }, take: 8,
    select: { id: true, name: true, updatedAt: true, user: { select: { id: true, name: true, email: true } }, _count: { select: { materials: true, quizzes: true, notes: true } } },
  });
  return NextResponse.json({ enabled, thesisAssistCreditCost, stats: { activeUsers: activeUsers.length, courses, materials, notes, flashcards, quizzes, attempts, exams, tasks, aiRuns, aiCredits: aiCredits._sum.credits ?? 0, averageScore: scores._avg.total ? Math.round(((scores._avg.score || 0) / scores._avg.total) * 100) : null }, recentCourses });
}

export async function PATCH(req: NextRequest) {
  const { admin, error } = await authorize(req);
  if (!admin) return error;
  let body: { enabled?: boolean; thesisAssistCreditCost?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (body.thesisAssistCreditCost !== undefined) {
    if (!Number.isInteger(body.thesisAssistCreditCost) || body.thesisAssistCreditCost < 5 || body.thesisAssistCreditCost > 100) return NextResponse.json({ error: "هزینه باید عدد صحیح بین ۵ تا ۱۰۰ اعتبار باشد" }, { status: 400 });
    await setThesisAssistCreditCost(body.thesisAssistCreditCost);
    return NextResponse.json({ thesisAssistCreditCost: body.thesisAssistCreditCost });
  }
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled باید true یا false باشد" }, { status: 400 });
  await setStudentWorkspaceEnabled(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}
