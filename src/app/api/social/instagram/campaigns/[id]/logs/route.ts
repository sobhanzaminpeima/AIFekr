export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const campaign = await prisma.instagramCommentCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.userId !== user.id) return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });

  const logs = await prisma.instagramCommentReplyLog.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ logs });
}
