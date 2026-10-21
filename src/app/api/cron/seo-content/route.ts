export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { prisma } from "@/lib/db/prisma";
import { runContentPlan } from "@/lib/seo/contentPlanService";

/** One post per tick: a run is eight model calls, so plans are worked through steadily rather than all at once. */
const PLANS_PER_TICK = 1;

/**
 * Blog automation scheduler. Hit by the system crontab (e.g. every 30 minutes):
 * starts the next due plan (enabled + nextRunAt <= now) in the background and
 * returns immediately -- the run itself takes minutes and reports through the
 * plan's lastError / posts list.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const due = await prisma.seoContentPlan.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() }, site: { user: { isBlocked: false } } },
    orderBy: { nextRunAt: "asc" },
    take: PLANS_PER_TICK,
    select: { id: true, siteId: true },
  });

  for (const p of due) {
    void runContentPlan(p.id).catch((e) => console.error("seo-content: plan run crashed:", e));
  }
  return NextResponse.json({ started: due.map((p) => p.siteId) });
}
