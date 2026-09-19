export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAccountStats } from "@/lib/instagram";
import { competitorsEnabled, discoverCompetitor } from "@/lib/social/competitors";
import { isCronAuthorized } from "@/lib/auth/cronAuth";

// Hit once a day by a system crontab entry — Instagram's API only exposes
// the CURRENT follower/media count, not history, so this is what builds up
// the growth-trend chart one data point at a time. Protected by a shared
// secret since it has no user session.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.instagramConnection.findMany();

  // One snapshot per RUN (this cron fires every few hours), not per day —
  // so the growth chart has a usable line within hours of connecting instead
  // of after a week. Rows are pruned to the last 180 below.
  const now = new Date();
  const bucket = new Date(now);
  bucket.setMinutes(0, 0, 0); // hour-aligned so re-runs in the same hour dedupe cleanly

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const conn of connections) {
    try {
      const stats = await getAccountStats(conn.igUserId, conn.accessToken);
      await prisma.instagramFollowerSnapshot.upsert({
        where: { userId_date: { userId: conn.userId, date: bucket } },
        update: { followersCount: stats.followersCount, mediaCount: stats.mediaCount },
        create: { userId: conn.userId, date: bucket, followersCount: stats.followersCount, mediaCount: stats.mediaCount },
      });
      // Keep history bounded — 180 points ≈ 45 days at a 6h cadence.
      const old = await prisma.instagramFollowerSnapshot.findMany({
        where: { userId: conn.userId }, orderBy: { date: "desc" }, skip: 180, select: { id: true },
      });
      if (old.length) await prisma.instagramFollowerSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      results.push({ userId: conn.userId, ok: true });
    } catch (e) {
      results.push({ userId: conn.userId, ok: false, error: e instanceof Error ? e.message : "error" });
    }
  }

  // Competitor snapshots ride the same schedule so a tenant's own growth and
  // their benchmarks are always sampled at comparable times. Silent no-op
  // until App Review lands (see lib/social/competitors.ts).
  let competitorsSnapshotted = 0;
  if (competitorsEnabled()) {
    const comps = await prisma.socialCompetitor.findMany({ where: { isActive: true } });
    for (const c of comps) {
      try {
        const data = await discoverCompetitor(c.username);
        await prisma.socialCompetitorSnapshot.create({
          data: { competitorId: c.id, followersCount: data.followersCount, mediaCount: data.mediaCount, topPosts: JSON.stringify(data.posts) },
        });
        if (c.lastError) await prisma.socialCompetitor.update({ where: { id: c.id }, data: { lastError: null } });
        competitorsSnapshotted++;
      } catch (e) {
        await prisma.socialCompetitor
          .update({ where: { id: c.id }, data: { lastError: e instanceof Error ? e.message : "error" } })
          .catch(() => {});
      }
    }
  }

  return NextResponse.json({ processed: results.length, results, competitorsSnapshotted });
}
