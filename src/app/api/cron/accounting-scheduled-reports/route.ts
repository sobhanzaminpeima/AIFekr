export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledReports } from "@/lib/accounting/scheduledReports";

// Hit by a system crontab entry, same shared-secret pattern as
// cron/crm-automation and cron/instagram-publish — no user session, not
// meant to be called from the browser. See scheduledReports.ts's doc comment
// for why a schedule's first due run never actually emails anyone here.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDueScheduledReports();
  return NextResponse.json(result);
}
