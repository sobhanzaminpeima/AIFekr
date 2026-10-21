export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledReports } from "@/lib/accounting/scheduledReports";
import { isCronAuthorized } from "@/lib/auth/cronAuth";

// Hit by a system crontab entry, same shared-secret pattern as
// cron/crm-automation and cron/instagram-publish — no user session, not
// meant to be called from the browser. See scheduledReports.ts's doc comment
// for why a schedule's first due run never actually emails anyone here.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDueScheduledReports();
  return NextResponse.json(result);
}
