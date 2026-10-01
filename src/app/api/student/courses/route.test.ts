import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-api-test-secret"; });

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";
import { GET as getCourseDetail } from "./[id]/route";

const userId = `student-course-api-${crypto.randomUUID()}`;
const token = signToken({ userId, role: "USER", plan: "FREE" });

beforeEach(async () => { await prisma.user.create({ data: { id: userId, email: `${userId}@example.test` } }); });
afterEach(async () => { await prisma.studentCourse.deleteMany({ where: { userId } }); await prisma.user.deleteMany({ where: { id: userId } }); });
afterAll(async () => prisma.$disconnect());

describe("POST /api/student/courses", () => {
  it("returns the same summary shape as the course list, so a newly created course can render immediately", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/student/courses", {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${token}` }, body: JSON.stringify({ name: "Physics" }),
    }));
    expect(response.status).toBe(201);
    const { course } = await response.json();
    expect(course.name).toBe("Physics");
    expect(course._count).toEqual({ materials: 0, notes: 0, flashcards: 0, exams: 0, quizzes: 0 });
    expect(course.exams).toEqual([]);
  });

  it("returns an owned course summary for the new student tutor and hides another student's course", async () => {
    const course = await prisma.studentCourse.create({ data: { userId, name: "Biology" } });
    const otherUserId = `${userId}-other`;
    await prisma.user.create({ data: { id: otherUserId, email: `${otherUserId}@example.test` } });
    try {
      const own = await getCourseDetail(new NextRequest(`https://aifekr.test/api/student/courses/${course.id}`, { headers: { Cookie: `token=${token}` } }), { params: { id: course.id } });
      expect(own.status).toBe(200);
      expect((await own.json()).course).toEqual({ id: course.id, name: "Biology" });

      const foreignCourse = await prisma.studentCourse.create({ data: { userId: otherUserId, name: "Private course" } });
      const foreign = await getCourseDetail(new NextRequest(`https://aifekr.test/api/student/courses/${foreignCourse.id}`, { headers: { Cookie: `token=${token}` } }), { params: { id: foreignCourse.id } });
      expect(foreign.status).toBe(404);
      await prisma.studentCourse.deleteMany({ where: { userId: otherUserId } });
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
  });
});
