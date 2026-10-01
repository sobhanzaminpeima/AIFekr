export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

const MAX_SESSION_SECONDS = 12 * 60 * 60;

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const daysParam = Number(new URL(req.url).searchParams.get("days") || 30);
  const days = Number.isInteger(daysParam) ? Math.max(7, Math.min(daysParam, 90)) : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const [active, rows] = await Promise.all([
    prisma.studentStudySession.findFirst({
      where: { userId: user.id, endedAt: null, activeUserKey: user.id },
      include: { course: { select: { id: true, name: true, color: true } } },
    }),
    prisma.studentStudySession.findMany({
      where: { userId: user.id, startedAt: { gte: since }, endedAt: { not: null } },
      orderBy: { startedAt: "desc" }, take: 1000,
      include: { course: { select: { id: true, name: true, color: true } } },
    }),
  ]);
  const byDay = new Map<string, number>();
  const byCourse = new Map<string, { courseId: string | null; courseName: string; seconds: number; sessions: number }>();
  for (const row of rows) {
    const date = row.startedAt.toISOString().slice(0, 10);
    byDay.set(date, (byDay.get(date) || 0) + row.durationSeconds);
    const key = row.courseId || "unassigned";
    const item = byCourse.get(key) || { courseId: row.courseId, courseName: row.course?.name || "بدون درس", seconds: 0, sessions: 0 };
    item.seconds += row.durationSeconds; item.sessions += 1; byCourse.set(key, item);
  }
  return NextResponse.json({
    days,
    active: active ? { id: active.id, startedAt: active.startedAt, course: active.course } : null,
    totalSeconds: rows.reduce((sum, row) => sum + row.durationSeconds, 0),
    sessionCount: rows.length,
    byDay: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, seconds]) => ({ day, seconds })),
    byCourse: Array.from(byCourse.values()).sort((a, b) => b.seconds - a.seconds),
    sessions: rows.map(({ id, startedAt, endedAt, durationSeconds, course }) => ({ id, startedAt, endedAt, durationSeconds, course })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { courseId?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (body.courseId) {
    const course = await prisma.studentCourse.findFirst({ where: { id: body.courseId, userId: user.id }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  }
  const existing = await prisma.studentStudySession.findFirst({ where: { activeUserKey: user.id }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "یک زمان‌سنج فعال دارید؛ ابتدا آن را متوقف کنید" }, { status: 409 });
  try {
    const session = await prisma.studentStudySession.create({
      data: { userId: user.id, courseId: body.courseId || null, activeUserKey: user.id },
      include: { course: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({ session: { id: session.id, startedAt: session.startedAt, course: session.course } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "زمان‌سنج دیگری همین حالا فعال شده است" }, { status: 409 });
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const session = await prisma.studentStudySession.findFirst({ where: { userId: user.id, activeUserKey: user.id, endedAt: null } });
  if (!session) return NextResponse.json({ error: "زمان‌سنج فعالی برای توقف وجود ندارد" }, { status: 404 });
  const endedAt = new Date();
  const elapsed = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);
  const durationSeconds = Math.max(1, Math.min(MAX_SESSION_SECONDS, elapsed));
  const updated = await prisma.studentStudySession.updateMany({
    where: { id: session.id, userId: user.id, activeUserKey: user.id, endedAt: null },
    data: { endedAt, durationSeconds, activeUserKey: null },
  });
  if (!updated.count) return NextResponse.json({ error: "این زمان‌سنج قبلاً متوقف شده است" }, { status: 409 });
  return NextResponse.json({ endedAt, durationSeconds });
}
