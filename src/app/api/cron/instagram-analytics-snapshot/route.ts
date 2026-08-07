export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAccountStats } from "@/lib/instagram";

// Hit once a day by a system crontab entry — Instagram's API only exposes
// the CURRENT follower/media count, not history, so this is what builds up
// the growth-trend chart one data point at a time. Protected by a shared
// secret since it has no user session.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.instagramConnection.findMany();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const conn of connections) {
    try {
      const stats = await getAccountStats(conn.igUserId, conn.accessToken);
      await prisma.instagramFollowerSnapshot.upsert({
        where: { userId_date: { userId: conn.userId, date: today } },
        update: { followersCount: stats.followersCount, mediaCount: stats.mediaCount },
        create: { userId: conn.userId, date: today, followersCount: stats.followersCount, mediaCount: stats.mediaCount },
      });
      results.push({ userId: conn.userId, ok: true });
    } catch (e) {
      results.push({ userId: conn.userId, ok: false, error: e instanceof Error ? e.message : "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
