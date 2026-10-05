export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getCreditCosts } from "@/lib/utils/creditCosts";
import { getAvailableCredits } from "@/lib/utils/teamCredits";
import { COURSE_ACTION, reconcileCourseJobs } from "@/lib/courses/generation";
import { courseBrief } from "@/lib/courses/content";
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  await reconcileCourseJobs();
  const [courses, costs, balance] = await Promise.all([
    prisma.aiCourse.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, fieldOfStudy: true, language: true, status: true, version: true, activeJobId: true } }), getCreditCosts(), getAvailableCredits(admin.id),
  ]);
  return NextResponse.json({ courses, cost: costs[COURSE_ACTION], balance, userId: admin.id }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  const parsed = courseBrief.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_COURSE_BRIEF" }, { status: 400 });
  const course = await prisma.aiCourse.create({ data: { ...parsed.data, creatorId: admin.id } });
  return NextResponse.json({ course }, { status: 201 });
}
