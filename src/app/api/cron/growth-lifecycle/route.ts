import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { runFollowupCycle } from "@/lib/followup/engine";
export const dynamic = "force-dynamic";

/**
 * Scheduled follow-up cycle (hourly). Runs the follow-up engine, the single
 * send path. With the engine off (the default) it plans and sends nothing;
 * in dry-run mode it only records intended sends.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { plan, processed } = await runFollowupCycle();
  return NextResponse.json({ mode: plan.mode, disabled: processed.disabled, planned: plan.planned, byRule: plan.byRule, claimed: processed.claimed, outcomes: processed.outcomes });
}
