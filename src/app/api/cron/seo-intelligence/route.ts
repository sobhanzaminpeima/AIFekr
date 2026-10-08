export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { processSeoQueue } from "@/lib/seo/intelligence/jobs";
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !await requireAdmin(req)) return unauthorizedResponse(req);
  return NextResponse.json({ processed: await processSeoQueue() });
}
