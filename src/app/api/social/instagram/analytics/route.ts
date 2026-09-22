export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getAccountStats, getRecentMedia, summarizeMediaByType } from "@/lib/instagram";
import { analyzeSocial } from "@/lib/social/analytics";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const conn = await prisma.instagramConnection.findFirst({ where: { userId: user.id, ...bizScope(businessId) } });
  if (!conn) return NextResponse.json({ error: "اینستاگرام متصل نیست" }, { status: 400 });

  const [snapshots, live] = await Promise.all([
    prisma.instagramFollowerSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      take: 180,
    }),
    getAccountStats(conn.igUserId, conn.accessToken).catch(() => null),
  ]);

  let media: Awaited<ReturnType<typeof getRecentMedia>> = [];
  let mediaError: string | null = null;
  try {
    media = await getRecentMedia(conn.igUserId, conn.accessToken, 12);
  } catch (err) {
    // Previously swallowed entirely — the UI just showed an empty gallery/
    // dropdown with no way to tell "no posts yet" apart from "token expired/
    // API call failed". Surface it so the frontend can prompt a reconnect.
    mediaError = err instanceof Error ? err.message : "خطا در دریافت پست‌های اینستاگرام";
    console.error("Instagram getRecentMedia failed:", err);
  }

  return NextResponse.json({
    igUsername: conn.igUsername,
    current: live,
    trend: snapshots.map((s) => ({ date: s.date, followersCount: s.followersCount, mediaCount: s.mediaCount })),
    recentMedia: media,
    mediaBreakdown: summarizeMediaByType(media),
    // Deterministic growth analysis (buckets, growth rate, engagement rate,
    // audience quality, per-type correlation, rule-based findings).
    analysis: analyzeSocial(
      snapshots.map((s) => ({ date: s.date, followersCount: s.followersCount, mediaCount: s.mediaCount })),
      media,
      !!mediaError
    ),
    mediaError,
  });
}
