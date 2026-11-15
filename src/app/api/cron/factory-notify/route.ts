export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { notifyFinishedFactoryJobs } from "@/lib/video-factory-hooks/finished";

/** E15: tells owners about finished or failed Video Factory jobs. Safe to run often; each job is told once. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ notified: await notifyFinishedFactoryJobs() });
}
