export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAutoPublish } from "@/lib/utils/planGates";
import { unsubscribeFromWebhooks } from "@/lib/instagram";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const conn = await prisma.instagramConnection.findFirst({ where: { userId: user.id, ...instagramWorkspaceScope(businessId) } });
  // Scheduled posts were queued for whichever Instagram account was connected
  // at the time -- with no account connected there's nothing for them to
  // auto-publish to, and surfacing them here made a *previous* account's
  // queue look like it belonged to the account just (re)connected.
  const posts = conn
    ? await prisma.scheduledPost.findMany({ where: { userId: user.id, businessId }, orderBy: { scheduledFor: "desc" }, take: 20 })
    : [];

  return NextResponse.json({
    connected: !!conn,
    igUsername: conn?.igUsername || null,
    canAutoPublish: canAutoPublish(user.plan),
    posts,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const conn = await prisma.instagramConnection.findFirst({ where: { userId: user.id, ...instagramWorkspaceScope(businessId) } });

  // Tell Meta to stop sending this account's comment/message webhooks to us —
  // best-effort, must run before the token is deleted below.
  if (conn?.igUserId && conn.accessToken) {
    await unsubscribeFromWebhooks(conn.igUserId, conn.accessToken).catch(() => {});
  }

  // A disconnect must leave nothing behind that would resurface — or worse,
  // silently apply to the NEXT account the user connects. Campaigns,
  // trigger/reply logs, follower-count history and the auto-publish queue
  // were all tied to whichever account was connected at the time.
  const workspace = instagramWorkspaceScope(businessId);
  const campaigns = await prisma.instagramCommentCampaign.findMany({ where: { userId: user.id, ...workspace }, select: { id: true } });
  await prisma.$transaction([
    prisma.instagramCommentReplyLog.deleteMany({ where: { userId: user.id, ...workspace } }),
    prisma.instagramCommentCampaign.deleteMany({ where: { userId: user.id, ...workspace } }),
    prisma.instagramFollowerSnapshot.deleteMany({ where: { userId: user.id, ...workspace } }),
    prisma.scheduledPost.deleteMany({ where: { userId: user.id, businessId } }),
    prisma.instagramDirectMessageLog.deleteMany({ where: { userId: user.id, ...workspace } }),
    prisma.instagramDirectRule.deleteMany({ where: { userId: user.id, ...workspace } }),
    prisma.instagramConnection.deleteMany({ where: { userId: user.id, ...workspace } }),
  ]);

  return NextResponse.json({ success: true });
}
