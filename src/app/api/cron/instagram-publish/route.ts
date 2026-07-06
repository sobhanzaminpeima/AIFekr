export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { publishToInstagram } from "@/lib/instagram";

// Hit by a system crontab entry every few minutes (see deployment notes) —
// this is what makes mode="auto" posts actually go out without a human
// clicking "publish". Protected by a shared secret since it has no user
// session; not meant to be called from the browser.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await prisma.scheduledPost.findMany({
    where: { mode: "auto", status: "PENDING", scheduledFor: { lte: new Date() } },
    include: { user: { include: { instagramConn: true } } },
  });

  const results = [];
  for (const post of due) {
    const conn = post.user.instagramConn;
    if (!conn || !post.imageUrl) {
      await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: "اتصال اینستاگرام یا تصویر موجود نیست" } });
      results.push({ id: post.id, ok: false });
      continue;
    }
    try {
      const igMediaId = await publishToInstagram(conn.igUserId, conn.accessToken, post.imageUrl, `${post.caption}\n\n${post.hashtags}`);
      await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", igMediaId } });
      results.push({ id: post.id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطا";
      await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: msg } });
      results.push({ id: post.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
