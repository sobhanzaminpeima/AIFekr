export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getAccountStats, getRecentMedia } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "اینستاگرام متصل نیست" }, { status: 400 });

  const [snapshots, live] = await Promise.all([
    prisma.instagramFollowerSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      take: 90,
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
    mediaError,
  });
}
