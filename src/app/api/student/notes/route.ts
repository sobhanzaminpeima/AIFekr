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
  const courseId = new URL(req.url).searchParams.get("courseId");
  const notes = await prisma.studentNote.findMany({ where: { userId: user.id, ...(courseId ? { courseId } : {}) }, include: { course: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(user);
  if (unavailable) return unavailable;
  let body: { courseId?: string; title?: string; content?: string; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  if (["title","content","question","answer","name","inviteCode","message","email","description"].some((key) => (body as Record<string, unknown>)[key] !== undefined && typeof (body as Record<string, unknown>)[key] !== "string")) return NextResponse.json({ error: "فیلدهای متنی معتبر نیستند" }, { status: 400 });
  const title = body.title?.trim();
  const content = body.content?.trim();
  if (!body.courseId || !title || !content || title.length > 200 || content.length > 20_000) return NextResponse.json({ error: "درس، عنوان و یادداشت معتبر الزامی است" }, { status: 400 });
  const course = await prisma.studentCourse.findFirst({ where: { id: body.courseId, userId: user.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "درس پیدا نشد" }, { status: 404 });
  if (body.id) {
    const result = await prisma.studentNote.updateMany({ where: { id: body.id, courseId: body.courseId, userId: user.id }, data: { title, content } });
    if (!result.count) return NextResponse.json({ error: "یادداشت پیدا نشد" }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  const note = await prisma.studentNote.create({ data: { userId: user.id, courseId: body.courseId, title, content } });
  return NextResponse.json({ note }, { status: 201 });
}
