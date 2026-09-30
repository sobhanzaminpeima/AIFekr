export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const campaign = await prisma.instagramCommentCampaign.findFirst({ where: { id, userId: user.id, ...instagramWorkspaceScope(await activeBusinessIdFor(user.id)) } });
  if (!campaign) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  const logs = await prisma.instagramCommentReplyLog.findMany({
    where: { campaignId: id, userId: user.id, businessId: campaign.businessId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ logs });
}
