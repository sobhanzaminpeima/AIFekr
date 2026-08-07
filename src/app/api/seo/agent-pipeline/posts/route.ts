export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const posts = await prisma.contentPost.findMany({
    where: { userId: user.id },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ posts });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { postId, heroImageUrl } = await req.json().catch(() => ({}));
  if (!postId || !heroImageUrl) return NextResponse.json({ error: "پارامترها ناقص است" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id: postId } });
  if (!post || post.userId !== user.id) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });

  const updated = await prisma.contentPost.update({ where: { id: postId }, data: { heroImageUrl } });
  return NextResponse.json({ post: updated });
}
