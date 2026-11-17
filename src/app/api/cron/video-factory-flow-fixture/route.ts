import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { processFactoryTick } from "@/lib/video-factory/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

/** Run a single asset-generation checkpoint for the server-configured test job. */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const jobId = process.env.VIDEO_FACTORY_FLOW_TEST_JOB_ID;
  if (!jobId || req.nextUrl.searchParams.get("jobId") !== jobId) {
    return NextResponse.json({ code: "FIXTURE_SCOPE_MISMATCH" }, { status: 409 });
  }
  try {
    return NextResponse.json({ processed: await processFactoryTick(jobId) });
  } catch {
    return NextResponse.json({ code: "WORKER_UNAVAILABLE" }, { status: 503 });
  }
}
