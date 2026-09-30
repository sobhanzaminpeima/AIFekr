export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { competitorsEnabled, discoverCompetitor, CompetitorLookupError } from "@/lib/social/competitors";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!competitorsEnabled()) {
    return NextResponse.json({ error: "این قابلیت هنوز فعال نشده است" }, { status: 503 });
  }

  const row = await prisma.socialCompetitor.findFirst({ where: { id: params.id, userId: user.id } });
  if (!row) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  try {
    const data = await discoverCompetitor(row.username);
    await prisma.socialCompetitorSnapshot.create({
      data: {
        competitorId: row.id,
        followersCount: data.followersCount,
        mediaCount: data.mediaCount,
        topPosts: JSON.stringify(data.posts),
      },
    });
    await prisma.socialCompetitor.update({ where: { id: row.id }, data: { lastError: null } });
    return NextResponse.json({ ok: true, followersCount: data.followersCount, posts: data.posts.length });
  } catch (e) {
    const msg = e instanceof CompetitorLookupError ? e.message : "خطا در دریافت اطلاعات";
    await prisma.socialCompetitor.update({ where: { id: row.id }, data: { lastError: msg } });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
