export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { normalizeLinks } from "@/lib/utils/campaignLinks";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";

async function loadOwnedCampaign(userId: string, businessId: string | null, id: string) {
  return prisma.instagramCommentCampaign.findFirst({ where: { id, userId, ...instagramWorkspaceScope(businessId) } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const owned = await loadOwnedCampaign(user.id, await activeBusinessIdFor(user.id), id);
  if (!owned) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim() || body.name.trim().length > 80) return NextResponse.json({ error: "نام کمپین باید بین ۱ تا ۸۰ نویسه باشد" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.keyword === "string" && body.keyword.trim()) data.keyword = body.keyword.trim();
  if (typeof body.dmMessage === "string" && body.dmMessage.trim()) data.dmMessage = body.dmMessage.trim();
  if (typeof body.publicReplyMessage === "string") data.publicReplyMessage = body.publicReplyMessage.trim() || null;
  if (body.links !== undefined) data.links = normalizeLinks(body.links);
  if (typeof body.followGateEnabled === "boolean") data.followGateEnabled = body.followGateEnabled;
  if (typeof body.followGatePrompt === "string") data.followGatePrompt = body.followGatePrompt.trim() || null;

  const campaign = await prisma.instagramCommentCampaign.updateMany({ where: { id, userId: user.id, ...instagramWorkspaceScope(await activeBusinessIdFor(user.id)) }, data });
  if (!campaign.count) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const owned = await loadOwnedCampaign(user.id, await activeBusinessIdFor(user.id), id);
  if (!owned) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  await prisma.$transaction([
    prisma.instagramCommentReplyLog.deleteMany({ where: { campaignId: id, userId: user.id, businessId: owned.businessId } }),
    prisma.instagramCommentCampaign.deleteMany({ where: { id, userId: user.id, ...instagramWorkspaceScope(await activeBusinessIdFor(user.id)) } }),
  ]);
  return NextResponse.json({ success: true });
}
