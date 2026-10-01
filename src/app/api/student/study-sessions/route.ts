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
  const search = new URL(req.url).searchParams;
  if (search.get("activeOnly") === "1") {
    const active = await prisma.studentStudySession.findFirst({
      where: { userId: user.id, endedAt: null, activeUserKey: user.id },
      select: { id: true, startedAt: true, lastResumedAt: true, pausedAt: true, durationSeconds: true, course: { select: { id: true, name: true, color: true } } },
    });
    return NextResponse.json({ active: active ? { ...active, elapsedSeconds: active.durationSeconds + (active.pausedAt ? 0 : Math.max(0, Math.floor((Date.now() - (active.lastResumedAt || active.startedAt).getTime()) / 1000))) } : null });
  }
  const daysParam = Number(new URL(req.url).searchParams.get("days") || 30);
  const days = Number.isInteger(daysParam) ? Math.max(7, Math.min(daysParam, 366)) : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const pageParam = Number(new URL(req.url).searchParams.get("page") || 0);
  const page = Number.isInteger(pageParam) ? Math.max(0, Math.min(pageParam, 100_000)) : 0;
  const pageSize = 50;
  const [active, rows, totals, courseTotals] = await Promise.all([
    prisma.studentStudySession.findFirst({
      where: { userId: user.id, endedAt: null, activeUserKey: user.id },
      select: { id: true, startedAt: true, lastResumedAt: true, pausedAt: true, durationSeconds: true, pauseHistory: true, course: { select: { id: true, name: true, color: true } } },
    }),
    prisma.studentStudySession.findMany({
      where: { userId: user.id, startedAt: { gte: since }, endedAt: { not: null } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: page * pageSize, take: pageSize,
      include: { course: { select: { id: true, name: true, color: true } } },
    }),
    prisma.studentStudySession.aggregate({
      where: { userId: user.id, startedAt: { gte: since }, endedAt: { not: null } },
      _sum: { durationSeconds: true }, _count: { _all: true },
    }),
    prisma.studentStudySession.groupBy({
      by: ["courseId"], where: { userId: user.id, startedAt: { gte: since }, endedAt: { not: null } },
      _sum: { durationSeconds: true }, _count: { _all: true },
    }),
  ]);
  const byDayRows = await prisma.studentStudySession.findMany({
    where: { userId: user.id, startedAt: { gte: since }, endedAt: { not: null } },
    select: { startedAt: true, durationSeconds: true }, orderBy: { startedAt: "asc" },
  });
  const byDay = new Map<string, number>();
  for (const row of byDayRows) {
    const day = row.startedAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + row.durationSeconds);
  }
  const courseIds = courseTotals.map((item) => item.courseId).filter((id): id is string => Boolean(id));
  const courseRows = courseIds.length ? await prisma.studentCourse.findMany({ where: { id: { in: courseIds }, userId: user.id }, select: { id: true, name: true } }) : [];
  const courseNames = new Map(courseRows.map((course) => [course.id, course.name]));
  const byCourse = courseTotals.map((item) => ({
    courseId: item.courseId,
    courseName: item.courseId ? courseNames.get(item.courseId) || "حذف‌شده" : "بدون درس",
    seconds: item._sum.durationSeconds || 0,
    sessions: item._count._all,
  })).sort((a, b) => b.seconds - a.seconds);
  return NextResponse.json({
    days,
    active: active ? { ...active, elapsedSeconds: active.durationSeconds + (active.pausedAt ? 0 : Math.max(0, Math.floor((Date.now() - (active.lastResumedAt || active.startedAt).getTime()) / 1000))) } : null,
    totalSeconds: totals._sum.durationSeconds || 0,
    sessionCount: totals._count._all,
    page, pageSize, hasMore: (page + 1) * pageSize < totals._count._all,
    byDay: Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, seconds]) => ({ day, seconds })),
    byCourse: Array.from(byCourse.values()).sort((a, b) => b.seconds - a.seconds),
    sessions: rows.map(({ id, startedAt, endedAt, durationSeconds, pauseHistory, course }) => ({ id, startedAt, endedAt, durationSeconds, pauseHistory, course })),
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
      data: { userId: user.id, courseId: body.courseId || null, activeUserKey: user.id, lastResumedAt: new Date() },
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
  let body: { action?: "pause" | "resume" | "stop" } = {};
  try { body = await req.json(); } catch { /* Empty body remains backward-compatible with stop. */ }
  const action = body.action || "stop";
  if (!["pause", "resume", "stop"].includes(action)) return NextResponse.json({ error: "عملیات زمان‌سنج معتبر نیست" }, { status: 400 });
  const session = await prisma.studentStudySession.findFirst({ where: { userId: user.id, activeUserKey: user.id, endedAt: null } });
  if (!session) return NextResponse.json({ error: "زمان‌سنج فعالی برای توقف وجود ندارد" }, { status: 404 });
  const now = new Date();

  if (action === "pause") {
    if (session.pausedAt) return NextResponse.json({ error: "زمان‌سنج از قبل متوقف موقت است" }, { status: 409 });
    const segmentSeconds = Math.max(0, Math.floor((now.getTime() - (session.lastResumedAt || session.startedAt).getTime()) / 1000));
    let pauses: { pausedAt: string; resumedAt: string | null }[] = [];
    try { pauses = JSON.parse(session.pauseHistory || "[]"); } catch { pauses = []; }
    pauses.push({ pausedAt: now.toISOString(), resumedAt: null });
    const updated = await prisma.studentStudySession.updateMany({
      where: { id: session.id, userId: user.id, activeUserKey: user.id, endedAt: null, pausedAt: null },
      data: { pausedAt: now, durationSeconds: Math.min(MAX_SESSION_SECONDS, session.durationSeconds + segmentSeconds), pauseHistory: JSON.stringify(pauses) },
    });
    if (!updated.count) return NextResponse.json({ error: "وضعیت زمان‌سنج تغییر کرده؛ صفحه را تازه‌سازی کن" }, { status: 409 });
    return NextResponse.json({ pausedAt: now, durationSeconds: Math.min(MAX_SESSION_SECONDS, session.durationSeconds + segmentSeconds) });
  }

  if (action === "resume") {
    if (!session.pausedAt) return NextResponse.json({ error: "زمان‌سنج متوقف موقت نیست" }, { status: 409 });
    let pauses: { pausedAt: string; resumedAt: string | null }[] = [];
    try { pauses = JSON.parse(session.pauseHistory || "[]"); } catch { pauses = []; }
    const lastOpen = [...pauses].reverse().find((pause) => !pause.resumedAt);
    if (lastOpen) lastOpen.resumedAt = now.toISOString();
    const updated = await prisma.studentStudySession.updateMany({
      where: { id: session.id, userId: user.id, activeUserKey: user.id, endedAt: null, pausedAt: { not: null } },
      data: { pausedAt: null, lastResumedAt: now, pauseHistory: JSON.stringify(pauses) },
    });
    if (!updated.count) return NextResponse.json({ error: "وضعیت زمان‌سنج تغییر کرده؛ صفحه را تازه‌سازی کن" }, { status: 409 });
    return NextResponse.json({ resumedAt: now, durationSeconds: session.durationSeconds });
  }

  const isPaused = !!session.pausedAt;
  const segmentSeconds = isPaused ? 0 : Math.max(0, Math.floor((now.getTime() - (session.lastResumedAt || session.startedAt).getTime()) / 1000));
  const durationSeconds = Math.max(1, Math.min(MAX_SESSION_SECONDS, session.durationSeconds + segmentSeconds));
  let pauses: { pausedAt: string; resumedAt: string | null }[] = [];
  try { pauses = JSON.parse(session.pauseHistory || "[]"); } catch { pauses = []; }
  const openPause = [...pauses].reverse().find((pause) => !pause.resumedAt);
  if (openPause) openPause.resumedAt = now.toISOString();
  const updated = await prisma.studentStudySession.updateMany({
    where: { id: session.id, userId: user.id, activeUserKey: user.id, endedAt: null },
    data: { endedAt: now, durationSeconds, activeUserKey: null, pausedAt: null, lastResumedAt: null, pauseHistory: JSON.stringify(pauses) },
  });
  if (!updated.count) return NextResponse.json({ error: "این زمان‌سنج قبلاً متوقف شده است" }, { status: 409 });
  return NextResponse.json({ endedAt: now, durationSeconds, pauses });
}
