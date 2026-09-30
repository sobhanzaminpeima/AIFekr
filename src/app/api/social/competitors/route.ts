export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { competitorsEnabled, discoverCompetitor, CompetitorLookupError, MAX_COMPETITORS_PER_TENANT } from "@/lib/social/competitors";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const rows = await prisma.socialCompetitor.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { snapshots: { orderBy: { takenAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({
    enabled: competitorsEnabled(),
    max: MAX_COMPETITORS_PER_TENANT,
    competitors: rows.map((c) => {
      const s = c.snapshots[0];
      let topPosts: unknown[] = [];
      try { topPosts = s ? JSON.parse(s.topPosts) : []; } catch { topPosts = []; }
      return {
        id: c.id,
        username: c.username,
        label: c.label,
        isActive: c.isActive,
        lastError: c.lastError,
        followersCount: s?.followersCount ?? null,
        mediaCount: s?.mediaCount ?? null,
        lastCheckedAt: s?.takenAt ?? null,
        topPosts,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.replace(/^@/, "").trim() : "";
  if (!username) return NextResponse.json({ error: "نام کاربری الزامی است" }, { status: 400 });

  const count = await prisma.socialCompetitor.count({ where: { userId: user.id } });
  if (count >= MAX_COMPETITORS_PER_TENANT) {
    return NextResponse.json({ error: `حداکثر ${MAX_COMPETITORS_PER_TENANT} رقیب مجاز است` }, { status: 400 });
  }

  const created = await prisma.socialCompetitor
    .create({ data: { userId: user.id, username, label: typeof body?.label === "string" ? body.label.slice(0, 120) : null } })
    .catch(() => null);
  if (!created) return NextResponse.json({ error: "این اکانت قبلاً اضافه شده" }, { status: 409 });

  // Try a first read immediately so the owner gets feedback now rather than
  // after the next cron run. A failure is recorded, not thrown away.
  if (competitorsEnabled()) {
    try {
      const data = await discoverCompetitor(username);
      await prisma.socialCompetitorSnapshot.create({
        data: {
          competitorId: created.id,
          followersCount: data.followersCount,
          mediaCount: data.mediaCount,
          topPosts: JSON.stringify(data.posts),
        },
      });
    } catch (e) {
      const msg = e instanceof CompetitorLookupError ? e.message : "خطا در دریافت اطلاعات";
      await prisma.socialCompetitor.update({ where: { id: created.id }, data: { lastError: msg } });
      return NextResponse.json({ id: created.id, warning: msg });
    }
  }

  return NextResponse.json({ id: created.id });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });
  await prisma.socialCompetitor.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
