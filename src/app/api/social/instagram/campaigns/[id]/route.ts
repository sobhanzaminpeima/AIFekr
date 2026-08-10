export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { normalizeLinks } from "@/lib/utils/campaignLinks";

async function loadOwnedCampaign(userId: string, id: string) {
  const campaign = await prisma.instagramCommentCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.userId !== userId) return null;
  return campaign;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const owned = await loadOwnedCampaign(user.id, id);
  if (!owned) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.keyword === "string" && body.keyword.trim()) data.keyword = body.keyword.trim();
  if (typeof body.dmMessage === "string" && body.dmMessage.trim()) data.dmMessage = body.dmMessage.trim();
  if (typeof body.publicReplyMessage === "string") data.publicReplyMessage = body.publicReplyMessage.trim() || null;
  if (body.links !== undefined) data.links = normalizeLinks(body.links);
  if (typeof body.followGateEnabled === "boolean") data.followGateEnabled = body.followGateEnabled;
  if (typeof body.followGatePrompt === "string") data.followGatePrompt = body.followGatePrompt.trim() || null;

  const campaign = await prisma.instagramCommentCampaign.update({ where: { id }, data });
  return NextResponse.json({ campaign });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const owned = await loadOwnedCampaign(user.id, id);
  if (!owned) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  await prisma.instagramCommentReplyLog.deleteMany({ where: { campaignId: id } });
  await prisma.instagramCommentCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
