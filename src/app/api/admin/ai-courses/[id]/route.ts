export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { courseContentSchema } from "@/lib/courses/content";
import { reconcileCourseJobs } from "@/lib/courses/generation";
import { courseBrief } from "@/lib/courses/content";
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin(req)) return forbiddenResponse();
  await reconcileCourseJobs();
  const course = await prisma.aiCourse.findUnique({ where: { id: params.id }, include: { jobs: { orderBy: { createdAt: "desc" }, take: 10 } } });
  return course ? NextResponse.json({ course }, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  const body = await req.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.version)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const course = await prisma.aiCourse.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (course.activeJobId) return NextResponse.json({ error: "ALREADY_GENERATING" }, { status: 409 });
  const brief = courseBrief.safeParse({ fieldOfStudy: body.fieldOfStudy ?? course.fieldOfStudy, title: body.title ?? course.title, description: body.description ?? course.description, language: body.language ?? course.language });
  if (!brief.success) return NextResponse.json({ error: "INVALID_COURSE_BRIEF" }, { status: 400 });
  const parsed = body.content !== undefined ? courseContentSchema.safeParse(body.content) : null;
  if (parsed && !parsed.success) return NextResponse.json({ error: "INVALID_COURSE_CONTENT" }, { status: 400 });
  const status = body.status ?? (parsed ? "GENERATED" : course.status);
  if (!["DRAFT", "GENERATED", "PUBLISHED", "ARCHIVED"].includes(status)) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  if (status === "PUBLISHED" && (!course.content || !["GENERATED", "PUBLISHED"].includes(course.status) || parsed)) return NextResponse.json({ error: "REVIEW_BEFORE_PUBLISH" }, { status: 409 });
  const result = await prisma.aiCourse.updateMany({ where: { id: course.id, version: body.version, activeJobId: null }, data: { ...brief.data, version: { increment: 1 }, ...(parsed?.success ? { content: JSON.stringify(parsed.data) } : {}), status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
  if (!result.count) return NextResponse.json({ error: "COURSE_CHANGED_REFRESH" }, { status: 409 });
  return NextResponse.json({ course: await prisma.aiCourse.findUnique({ where: { id: course.id } }) });
}
