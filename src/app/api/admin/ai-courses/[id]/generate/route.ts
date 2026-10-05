export const dynamic = "force-dynamic";
export const maxDuration = 240;
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { generateCourse } from "@/lib/courses/generation";
import { courseError, courseJobView } from "@/lib/courses/http";
import { z } from "zod";
const inputSchema = z.object({ idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/), expectedCredits: z.number().int().nonnegative(), regenerate: z.boolean().optional(), confirmRegeneration: z.boolean().optional() });
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req); if (!admin) return forbiddenResponse();
  if (!admin.featureAccess) return NextResponse.json({ error: "SUBSCRIPTION_EXPIRED", code: "SUBSCRIPTION_EXPIRED", renewUrl: "/pricing" }, { status: 402 });
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  try {
    const job = await generateCourse(admin.id, params.id, {...input.data,phase:"BLUEPRINT"});
    return NextResponse.json({ job: courseJobView(job) }, { status: job.status === "GENERATING" ? 202 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return courseError(error); }
}
