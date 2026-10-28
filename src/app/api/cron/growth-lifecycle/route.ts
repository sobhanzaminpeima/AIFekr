import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { runLifecycle } from "@/lib/growth/automation";
export const dynamic = "force-dynamic";

/** Scheduled lifecycle run. Sends nothing unless both lifecycle flags are on and an admin enabled the rule. */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runLifecycle({ dryRun: false });
  return NextResponse.json({ dryRun: result.dryRun, blocked: result.blocked, quiet: result.quiet, sent: result.results.reduce((n, r) => n + r.sent, 0), rules: result.results.map(r => ({ key: r.key, enabled: r.enabled, eligible: r.eligible, sent: r.sent, suppressed: r.suppressed })) });
}
