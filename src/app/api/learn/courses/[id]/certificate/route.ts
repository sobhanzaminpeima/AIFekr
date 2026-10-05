export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { prisma } from "@/lib/db/prisma";
const escape = (text: string) => Array.from(text).map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char).join("").replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const denied = await studentWorkspaceDisabledResponse(user); if (denied) return denied;
  const progress = await prisma.aiCourseProgress.findFirst({ where: { userId: user.id, courseId: params.id, completedAt: { not: null }, certificateId: { not: null } }, orderBy: { completedAt: "desc" }, include: { course: { select: { title: true } } } });
  if (!progress) return NextResponse.json({ error: "CERTIFICATE_NOT_EARNED" }, { status: 404 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#101c35"/><rect x="35" y="35" width="1130" height="730" rx="24" fill="none" stroke="#e8b95e" stroke-width="3"/><g font-family="Arial,sans-serif" text-anchor="middle" fill="#fff"><text x="600" y="135" font-size="40" fill="#e8b95e">AIFekr</text><text x="600" y="220" font-size="38">Certificate of Course Completion</text><text x="600" y="325" font-size="32">${escape(progress.certificateName || user.name || "AIFekr Student")}</text><text x="600" y="415" font-size="28">${escape(progress.certificateTitle || progress.course.title)}</text><text x="600" y="510" font-size="20">Completed ${progress.completedAt!.toISOString().slice(0,10)}</text><text x="600" y="580" font-size="16">${escape(progress.certificateId!)}</text><text x="600" y="680" font-size="17">Learning completion record — not an accredited academic qualification</text></g></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": 'attachment; filename="AIFekr-course-certificate.svg"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
