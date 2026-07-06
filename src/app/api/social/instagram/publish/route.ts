export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { publishToInstagram } from "@/lib/instagram";

// Manual "انتشار الان" trigger — same underlying call the cron uses for
// mode="auto" posts, just fired on demand instead of at scheduledFor.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { postId } = await req.json();
  const post = await prisma.scheduledPost.findFirst({ where: { id: postId, userId: user.id } });
  if (!post) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });
  if (post.status === "PUBLISHED") return NextResponse.json({ error: "این پست قبلاً منتشر شده" }, { status: 400 });
  if (!post.imageUrl) return NextResponse.json({ error: "این پست تصویر ندارد و از طریق API قابل انتشار نیست" }, { status: 400 });

  const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "حساب اینستاگرام متصل نیست" }, { status: 400 });

  try {
    const igMediaId = await publishToInstagram(conn.igUserId, conn.accessToken, post.imageUrl, `${post.caption}\n\n${post.hashtags}`);
    const updated = await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", igMediaId } });
    return NextResponse.json({ post: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: msg } });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
