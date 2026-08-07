export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { auditContentPost } from "@/lib/agents/seoAudit";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { postId } = await req.json().catch(() => ({}));
  if (!postId) return NextResponse.json({ error: "postId الزامی است" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id: postId } });
  if (!post || post.userId !== user.id) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });

  const result = auditContentPost(post);
  return NextResponse.json(result);
}
