export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  const courseId = new URL(req.url).searchParams.get("courseId") || undefined;
  const tasks = await prisma.studentTask.findMany({
    where: { userId: user.id, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, name: true, color: true } } },
    orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }], take: 100,
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { title?: string; description?: string; courseId?: string | null; taskType?: string; dueAt?: string | null; priority?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (body.description !== undefined && typeof body.description !== "string") return NextResponse.json({ error: "توضیحات باید متن باشد" }, { status: 400 });
  const description = body.description?.trim() || "";
  const taskType = body.taskType || "assignment";
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  const priority = body.priority ?? 2;
  if (!title || title.length > 200 || description.length > 4000 || !["assignment", "study"].includes(taskType) || !Number.isInteger(priority) || priority < 1 || priority > 3 || (body.dueAt && (!dueAt || Number.isNaN(dueAt.getTime())))) {
    return NextResponse.json({ error: "عنوان، نوع، اولویت یا تاریخ معتبر نیست" }, { status: 400 });
  }
  if (body.courseId) {
    const course = await prisma.studentCourse.findFirst({ where: { id: body.courseId, userId: user.id }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  }
  const task = await prisma.studentTask.create({ data: {
    userId: user.id, courseId: body.courseId || null, title, description, taskType,
    dueAt, priority,
  }, include: { course: { select: { id: true, name: true, color: true } } } });
  return NextResponse.json({ task }, { status: 201 });
}
