export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { reconcileCourseJobs } from "@/lib/courses/generation";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
export async function POST(req: NextRequest) {
  const authorized = isCronAuthorized(req);
  if (!authorized && !await requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ recovered: await reconcileCourseJobs() });
}
