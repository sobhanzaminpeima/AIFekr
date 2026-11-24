export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { dayKey, earnedBadges, latestActivity, studyStreak, STUDENT_BADGES, type ActivityItem } from "@/lib/student/insights";

const STREAK_WINDOW_DAYS = 120;

/** Streak, badges and recent activity for the signed-in student's dashboard and profile. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const timeZone = new URL(req.url).searchParams.get("timeZone") || "UTC";
  try { dayKey(new Date(), timeZone); } catch { return NextResponse.json({ error: "Invalid time zone" }, { status: 400 }); }

  const userId = user.id;
  const since = new Date(Date.now() - STREAK_WINDOW_DAYS * 86400000);
  const [courses, materials, attempts, reviewedCards, groups, sessions, recentMaterials, recentNotes, recentCards] = await Promise.all([
    prisma.studentCourse.count({ where: { userId } }),
    prisma.studentMaterial.count({ where: { userId } }),
    prisma.studentQuizAttempt.findMany({ where: { userId }, select: { score: true, total: true, completedAt: true, quiz: { select: { title: true } } }, orderBy: { completedAt: "desc" }, take: 50 }),
    prisma.studentFlashcard.count({ where: { userId, reviewCount: { gt: 0 } } }),
    prisma.studentStudyGroupMember.count({ where: { userId } }),
    prisma.studentStudySession.findMany({ where: { userId, startedAt: { gte: since }, endedAt: { not: null } }, select: { startedAt: true, durationSeconds: true, course: { select: { name: true } } }, orderBy: { startedAt: "desc" } }),
    prisma.studentMaterial.findMany({ where: { userId }, select: { title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.studentNote.findMany({ where: { userId }, select: { title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.studentFlashcard.groupBy({ by: ["courseId"], where: { userId }, _count: { _all: true }, _max: { createdAt: true }, orderBy: { _max: { createdAt: "desc" } }, take: 3 }),
  ]);

  const today = dayKey(new Date(), timeZone);
  const streak = studyStreak(sessions.filter((s) => s.durationSeconds > 0).map((s) => dayKey(s.startedAt, timeZone)), today);
  const bestQuizPercent = attempts.reduce((best, a) => (a.total > 0 ? Math.max(best, Math.round((a.score / a.total) * 100)) : best), 0);
  const earned = earnedBadges({ courses, materials, quizAttempts: attempts.length, bestQuizPercent, reviewedCards, streak, groups });

  const cardCourses = recentCards.length
    ? await prisma.studentCourse.findMany({ where: { userId, id: { in: recentCards.map((c) => c.courseId) } }, select: { id: true, name: true } })
    : [];
  const courseName = new Map(cardCourses.map((c) => [c.id, c.name]));
  const activity: ActivityItem[] = [
    ...recentMaterials.map((m) => ({ kind: "material" as const, title: m.title, at: m.createdAt.toISOString() })),
    ...recentNotes.map((n) => ({ kind: "note" as const, title: n.title, at: n.createdAt.toISOString() })),
    ...attempts.slice(0, 5).map((a) => ({ kind: "quiz" as const, title: a.quiz.title, at: a.completedAt.toISOString() })),
    ...recentCards.filter((c) => c._max.createdAt).map((c) => ({ kind: "flashcards" as const, title: courseName.get(c.courseId) || "", at: c._max.createdAt!.toISOString() })),
    ...sessions.slice(0, 5).map((s) => ({ kind: "session" as const, title: s.course?.name || "", at: s.startedAt.toISOString() })),
  ];

  return NextResponse.json({
    streak,
    stats: { courses, materials, quizAttempts: attempts.length, bestQuizPercent, reviewedCards, groups },
    badges: STUDENT_BADGES.map((id) => ({ id, earned: earned[id] })),
    activity: latestActivity(activity),
  });
}
