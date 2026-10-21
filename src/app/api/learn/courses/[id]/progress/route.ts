export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";
import { saveCourseProgress } from "@/lib/courses/learning";
import { courseError } from "@/lib/courses/http";
import { z } from "zod";
const schema = z.object({ lessonId: z.string().regex(/^(?:\d+:\d+|final)$/), action: z.enum(["complete", "quiz", "start"]), answers: z.array(z.union([z.number().int().min(0).max(11),z.array(z.number().int().min(0).max(11)).max(12),z.boolean(),z.string().max(2000)])).max(30).optional(), assessmentToken:z.string().max(4000).optional(), requestKey:z.string().uuid() }).strict();
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const denied = await studentWorkspaceDisabledResponse(user); if (denied) return denied;
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try { return NextResponse.json(await saveCourseProgress(user.id, params.id, input.data)); } catch (error) { return courseError(error); }
}
