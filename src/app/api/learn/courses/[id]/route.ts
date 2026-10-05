export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { prisma } from "@/lib/db/prisma";
import { publicCourseContent } from "@/lib/courses/content";
import { publishedCourse } from "@/lib/courses/learning";
import { courseError } from "@/lib/courses/http";
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const denied = await studentWorkspaceDisabledResponse(user); if (denied) return denied;
  try {
    const { course, content } = await publishedCourse(params.id);
    const progress = await prisma.aiCourseProgress.findUnique({ where: { userId_courseId_version: { userId: user.id, courseId: course.id, version: course.version } } });
    return NextResponse.json({ course: { id: course.id, title: course.title, fieldOfStudy: course.fieldOfStudy, language: course.language, version: course.version, content: publicCourseContent(content) }, progress }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return courseError(error); }
}
