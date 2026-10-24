export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { refundCredits } from "@/lib/utils/teamCredits";
import { logError } from "@/lib/logging/errorLog";

// Hit by a system crontab entry every ~30 minutes, same shared-secret pattern
// as the other cron routes.
//
// Video and music credits are charged when the provider job starts and only
// refunded by video/status or music/status when the *user's browser* polls a
// terminal failure. A job the user never comes back to check -- tab closed,
// provider lost the job, webhook never arrived -- kept the credits forever.
// Any job that still has no real output URL after STUCK_AFTER_MS is treated
// as failed and refunded exactly once (the `refunded: false` claim makes a
// concurrent status poll unable to refund it a second time).
const STUCK_AFTER_MS = 6 * 60 * 60 * 1000;
const BATCH = 200;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  // A finished job's `url` is the stored media URL; while pending it holds the
  // provider's job id (see video/generate and music/generate).
  const pending = { refunded: false, createdAt: { lt: cutoff }, NOT: [{ url: { startsWith: "http" } }, { url: "" }] };
  const [videos, tracks] = await Promise.all([
    prisma.generatedVideo.findMany({ where: pending, select: { id: true, userId: true, credits: true }, take: BATCH }),
    prisma.generatedMusic.findMany({ where: pending, select: { id: true, userId: true, credits: true }, take: BATCH }),
  ]);

  let refunded = 0;
  for (const [kind, rows] of [["video", videos], ["music", tracks]] as const) {
    for (const row of rows) {
      try {
        const claim = kind === "video"
          ? await prisma.generatedVideo.updateMany({ where: { id: row.id, refunded: false }, data: { refunded: true } })
          : await prisma.generatedMusic.updateMany({ where: { id: row.id, refunded: false }, data: { refunded: true } });
        if (!claim.count) continue;
        await refundCredits(row.userId, row.credits);
        refunded += 1;
      } catch (error) {
        await logError({ source: "/api/cron/media-job-refunds", error, userId: row.userId });
      }
    }
  }

  return NextResponse.json({ checked: videos.length + tracks.length, refunded });
}
