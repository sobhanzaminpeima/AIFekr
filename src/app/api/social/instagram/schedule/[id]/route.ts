export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const post = await prisma.scheduledPost.findUnique({ where: { id } });
  if (!post || post.userId !== user.id) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });
  if (post.status !== "PENDING") {
    return NextResponse.json({ error: "فقط پست‌های در صف انتظار قابل لغو هستند" }, { status: 400 });
  }

  await prisma.scheduledPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
