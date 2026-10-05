export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { prisma } from "@/lib/db/prisma";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const denied = await studentWorkspaceDisabledResponse(user); if (denied) return denied;
  const courses = await prisma.aiCourse.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, title: true, fieldOfStudy: true, description: true, language: true, version: true } });
  return NextResponse.json({ courses }, { headers: { "Cache-Control": "private, no-store" } });
}
