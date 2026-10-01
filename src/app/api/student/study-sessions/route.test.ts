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
});
beforeEach(async () => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test` } });
  await prisma.siteSetting.upsert({ where: { key: "student_workspace_enabled" }, create: { key: "student_workspace_enabled", value: "true" }, update: { value: "true" } });
});
afterEach(async () => { await prisma.user.deleteMany({ where: { id: userId } }); });
afterAll(async () => prisma.$disconnect());

describe("student study sessions", () => {
  it("records a server-timed session and returns a course/day report", async () => {
    const started = await POST(req("POST", { courseId: null }));
    expect(started.status).toBe(201);
    expect((await POST(req("POST", {}))).status).toBe(409);

    await prisma.studentStudySession.updateMany({ where: { userId, endedAt: null }, data: { startedAt: new Date(Date.now() - 95_000) } });
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

  it("enforces the per-user student-module override", async () => {
    await prisma.userModuleOverride.create({ data: { userId, moduleKey: "student.workspace", enabled: false } });
    expect((await POST(req("POST", {}))).status).toBe(503);
  });
});
