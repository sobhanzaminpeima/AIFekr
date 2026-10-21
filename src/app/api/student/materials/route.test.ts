import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-material-test-secret"; });

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";

const userId = `student-material-api-${crypto.randomUUID()}`;
const token = signToken({ userId, role: "USER", plan: "FREE" });
let courseId = "";

beforeEach(async () => {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, accountType: "STUDENT", plan: "STUDENT_MONTHLY", planExpiry: new Date(Date.now() + 86400000) } });
  const course = await prisma.studentCourse.create({ data: { userId, name: "History" } });
  courseId = course.id;
});
afterEach(async () => { await prisma.studentCourse.deleteMany({ where: { userId } }); await prisma.user.deleteMany({ where: { id: userId } }); });
afterAll(async () => prisma.$disconnect());

describe("POST /api/student/materials", () => {
  it("persists JSON/pasted-text materials instead of requiring multipart form data", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/student/materials", {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
      body: JSON.stringify({ courseId, title: "Lecture notes", content: "Stored notes for later study." }),
    }));
    expect(response.status).toBe(201);
    const { material } = await response.json();
    expect(material.content).toBeUndefined();
    const stored = await prisma.studentMaterial.findUnique({ where: { id: material.id } });
    expect(stored?.content).toBe("Stored notes for later study.");
    expect(stored?.userId).toBe(userId);
  });
});
