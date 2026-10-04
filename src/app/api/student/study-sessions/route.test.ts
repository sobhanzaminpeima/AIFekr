import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-timer-test-secret"; });
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { PATCH, POST, GET } from "./route";

const userId = `student-timer-${crypto.randomUUID()}`;
const req = (method: string, body?: unknown, suffix = "") => new NextRequest(`https://aifekr.test/api/student/study-sessions${suffix}`, { method, headers: { Cookie: `token=${signToken({ userId, role: "USER", plan: "FREE" })}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeAll(async () => {
  const sql = readFileSync(path.resolve(process.cwd(), "prisma/migrations/20261002_student_study_sessions/migration.sql"), "utf8");
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
  const columns = await prisma.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info("StudentStudySession")');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("pausedAt")) await prisma.$executeRawUnsafe('ALTER TABLE "StudentStudySession" ADD COLUMN "pausedAt" DATETIME');
  if (!names.has("lastResumedAt")) await prisma.$executeRawUnsafe('ALTER TABLE "StudentStudySession" ADD COLUMN "lastResumedAt" DATETIME');
  if (!names.has("pauseHistory")) await prisma.$executeRawUnsafe('ALTER TABLE "StudentStudySession" ADD COLUMN "pauseHistory" TEXT NOT NULL DEFAULT \'[]\'');
});
beforeEach(async () => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, accountType: "STUDENT", plan: "STUDENT_MONTHLY", planExpiry: new Date(Date.now() + 86400000) } });
  await prisma.siteSetting.upsert({ where: { key: "student_workspace_enabled" }, create: { key: "student_workspace_enabled", value: "true" }, update: { value: "true" } });
});
afterEach(async () => { await prisma.user.deleteMany({ where: { id: userId } }); });
afterAll(async () => prisma.$disconnect());

describe("student study sessions", () => {
  it("groups a late UTC session by the student's local day", async () => {
    await prisma.studentStudySession.create({ data: { userId, startedAt: new Date("2026-10-04T22:30:00Z"), endedAt: new Date("2026-10-04T22:40:00Z"), durationSeconds: 600 } });
    const data = await (await GET(req("GET", undefined, "?days=366&timeZone=Europe%2FBucharest"))).json();
    expect(data.byDay).toContainEqual({ day: "2026-10-05", seconds: 600 });
    expect((await GET(req("GET", undefined, "?timeZone=invalid-zone"))).status).toBe(400);
  });
  it("records a server-timed session and returns a course/day report", async () => {
    const started = await POST(req("POST", { courseId: null }));
    expect(started.status).toBe(201);
    expect((await POST(req("POST", {}))).status).toBe(409);

    const resumedAt = new Date(Date.now() - 95_000);
    await prisma.studentStudySession.updateMany({ where: { userId, endedAt: null }, data: { startedAt: resumedAt, lastResumedAt: resumedAt } });
    const stopped = await PATCH(req("PATCH", {}));
    expect(stopped.status).toBe(200);
    const result = await stopped.json();
    expect(result.durationSeconds).toBeGreaterThanOrEqual(90);
    expect(result.durationSeconds).toBeLessThanOrEqual(100);

    const report = await GET(req("GET"));
    const data = await report.json();
    expect(data.sessionCount).toBe(1);
    expect(data.totalSeconds).toBe(result.durationSeconds);
    expect(data.byDay).toHaveLength(1);
  });

  it("pauses and resumes without counting break time and exposes pauses to reports", async () => {
    await POST(req("POST", {}));
    const beforePause = new Date(Date.now() - 80_000);
    await prisma.studentStudySession.updateMany({ where: { userId, endedAt: null }, data: { startedAt: beforePause, lastResumedAt: beforePause } });
    const paused = await PATCH(req("PATCH", { action: "pause" }));
    expect(paused.status).toBe(200);
    const activeWhilePaused = await (await GET(req("GET", undefined, "?activeOnly=1"))).json();
    expect(activeWhilePaused.active.pausedAt).toBeTruthy();
    expect(activeWhilePaused.active.elapsedSeconds).toBeGreaterThanOrEqual(78);
    expect(activeWhilePaused.active.elapsedSeconds).toBeLessThanOrEqual(82);

    const activeId = activeWhilePaused.active.id;
    const pauseStartedAt = new Date(Date.now() - 20_000);
    await prisma.studentStudySession.update({ where: { id: activeId }, data: { pausedAt: pauseStartedAt, pauseHistory: JSON.stringify([{ pausedAt: pauseStartedAt.toISOString(), resumedAt: null }]) } });
    const resumed = await PATCH(req("PATCH", { action: "resume" }));
    expect(resumed.status).toBe(200);
    const afterResume = await (await GET(req("GET", undefined, "?activeOnly=1"))).json();
    expect(afterResume.active.pausedAt).toBeNull();
    expect(afterResume.active.elapsedSeconds).toBeGreaterThanOrEqual(78);
    expect(afterResume.active.elapsedSeconds).toBeLessThanOrEqual(83);

    const stopped = await PATCH(req("PATCH", { action: "stop" }));
    expect(stopped.status).toBe(200);
    const session = await prisma.studentStudySession.findFirst({ where: { userId, endedAt: { not: null } }, orderBy: { startedAt: "desc" } });
    expect(session?.durationSeconds).toBeLessThan(90);
    const pauses = JSON.parse(session?.pauseHistory || "[]");
    expect(pauses).toHaveLength(1);
    expect(pauses[0].resumedAt).toBeTruthy();
    expect(new Date(pauses[0].resumedAt).getTime() - new Date(pauses[0].pausedAt).getTime()).toBeGreaterThanOrEqual(19_000);
  });

  it("aggregates the full year while returning session details in stable pages", async () => {
    const now = Date.now();
    await prisma.studentStudySession.createMany({
      data: Array.from({ length: 55 }, (_, index) => {
        const startedAt = new Date(now - index * 86_400_000);
        return {
          id: `study-page-${index}-${crypto.randomUUID()}`,
          userId,
          courseId: null,
          startedAt,
          endedAt: new Date(startedAt.getTime() + 120_000),
          durationSeconds: 120,
        };
      }),
    });

    const first = await (await GET(req("GET", undefined, "?days=365&page=0"))).json();
    const second = await (await GET(req("GET", undefined, "?days=365&page=1"))).json();
    expect(first.days).toBe(365);
    expect(first.sessionCount).toBe(55);
    expect(first.totalSeconds).toBe(6_600);
    expect(first.sessions).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(second.sessions).toHaveLength(5);
    expect(second.hasMore).toBe(false);
    expect(new Set([...first.sessions, ...second.sessions].map((session: { id: string }) => session.id)).size).toBe(55);
  });

  it("enforces the per-user student-module override", async () => {
    await prisma.userModuleOverride.create({ data: { userId, moduleKey: "student.workspace", enabled: false } });
    expect((await POST(req("POST", {}))).status).toBe(403);
  });
});
