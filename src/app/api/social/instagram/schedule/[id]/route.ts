export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;
  const businessId = await activeBusinessIdFor(user.id);

  const post = await prisma.scheduledPost.findFirst({ where: { id, userId: user.id, ...instagramWorkspaceScope(businessId) } });
  if (!post) return NextResponse.json({ error: "پست یافت نشد" }, { status: 404 });
  if (post.status !== "PENDING") {
    return NextResponse.json({ error: "فقط پست‌های در صف انتظار قابل لغو هستند" }, { status: 400 });
  }

  await prisma.scheduledPost.deleteMany({ where: { id, userId: user.id, ...instagramWorkspaceScope(businessId) } });
  return NextResponse.json({ success: true });
}
