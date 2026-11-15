export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { canAutoPublish } from "@/lib/utils/planGates";
import { scheduleEdit } from "@/lib/instagram/scheduleEdit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
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

/** Roadmap E8: change a post that is still waiting (text, media, time or mode), e.g. after dragging it on the calendar. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;
  const businessId = await activeBusinessIdFor(user.id);
  const post = await prisma.scheduledPost.findFirst({ where: { id, userId: user.id, ...instagramWorkspaceScope(businessId) } });
  if (!post) return NextResponse.json({ error: "پست یافت نشد", code: "NOT_FOUND" }, { status: 404 });
  const result = scheduleEdit(post, await req.json().catch(() => ({})), canAutoPublish(user.plan));
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.error }, { status: 400 });
  // Only a still-waiting row is changed, so a post the worker just claimed is never edited under it.
  const changed = await prisma.scheduledPost.updateMany({ where: { id, userId: user.id, status: "PENDING", ...instagramWorkspaceScope(businessId) }, data: result.data });
  if (!changed.count) return NextResponse.json({ error: "NOT_PENDING", code: "NOT_PENDING" }, { status: 409 });
  return NextResponse.json({ post: await prisma.scheduledPost.findUnique({ where: { id } }) });
}
