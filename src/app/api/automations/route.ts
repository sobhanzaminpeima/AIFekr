export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { unifyAutomations } from "@/lib/automation/unified";

/** E7, first slice: every automation of the signed-in account's workspace in one list. No message text is returned. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const businessId = await activeBusinessIdFor(user.id);
  const workspace = { userId: user.id, ...instagramWorkspaceScope(businessId) };
  const [comment, direct, crm] = await Promise.all([
    prisma.instagramCommentCampaign.findMany({ where: workspace, select: { id: true, name: true, keyword: true, postId: true, followGateEnabled: true, publicReplyMessage: true, isActive: true, triggerCount: true, createdAt: true } }),
    prisma.instagramDirectRule.findMany({ where: workspace, select: { id: true, name: true, triggerType: true, keywords: true, followGateEnabled: true, isActive: true, triggerCount: true, createdAt: true } }),
    prisma.crmAutomationRule.findMany({ where: { userId: user.id, ...(businessId ? { businessId } : {}) }, select: { id: true, name: true, trigger: true, condition: true, action: true, isActive: true, createdAt: true } }),
  ]);
  return NextResponse.json({ automations: unifyAutomations({ comment, direct, crm }) });
}
