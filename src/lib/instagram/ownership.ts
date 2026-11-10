import { prisma } from "@/lib/db/prisma";
import { unsubscribeFromWebhooks } from "@/lib/instagram";
import { instagramWorkspaceScope } from "./workspaceScope";

export type OtherConnection = { id: string; userId: string; businessId: string | null; tokenExpiry: Date | null };

export type Ownership =
  | { kind: "free" }
  | { kind: "other_account" }
  | { kind: "other_workspace" }
  /** Every other link has an expired token: whoever just passed Meta's login owns the account and may take it over. */
  | { kind: "stale"; connectionIds: string[] };

/**
 * Who else holds this Instagram account. `others` excludes the buyer's own
 * workspace, so reconnecting there stays an idempotent success.
 * A missing expiry is treated as live: only a known-expired token is stale.
 */
export function classifyOwnership(others: OtherConnection[], userId: string, now = new Date()): Ownership {
  if (!others.length) return { kind: "free" };
  const live = others.filter((c) => !c.tokenExpiry || c.tokenExpiry.getTime() > now.getTime());
  if (!live.length) return { kind: "stale", connectionIds: others.map((c) => c.id) };
  return live.some((c) => c.userId !== userId) ? { kind: "other_account" } : { kind: "other_workspace" };
}

/** Removes a connection and everything tied to it, exactly as the owner's own disconnect does. Audited. */
export async function releaseInstagramConnection(id: string, actorId: string, reason: "admin_release" | "stale_reclaim") {
  const connection = await prisma.instagramConnection.findUnique({ where: { id } });
  if (!connection) return false;
  await unsubscribeFromWebhooks(connection.igUserId, connection.accessToken).catch(() => {});
  const { userId, businessId } = connection;
  const workspace = instagramWorkspaceScope(businessId);
  const campaigns = await prisma.instagramCommentCampaign.findMany({ where: { userId, ...workspace }, select: { id: true } });
  await prisma.$transaction([
    prisma.instagramCommentReplyLog.deleteMany({ where: { OR: [{ userId, ...workspace }, { campaignId: { in: campaigns.map((c) => c.id) } }] } }),
    prisma.instagramCommentCampaign.deleteMany({ where: { userId, ...workspace } }),
    prisma.instagramFollowerSnapshot.deleteMany({ where: { userId, ...workspace } }),
    prisma.scheduledPost.deleteMany({ where: { userId, businessId } }),
    prisma.instagramDirectMessageLog.deleteMany({ where: { userId, ...workspace } }),
    prisma.instagramDirectRule.deleteMany({ where: { userId, ...workspace } }),
    prisma.instagramConnection.delete({ where: { id } }),
    prisma.auditLog.create({
      data: { actorId, action: `instagram_connection.${reason}`, targetId: userId, metadata: JSON.stringify({ igUserId: connection.igUserId, igUsername: connection.igUsername, businessId }) },
    }),
  ]);
  return true;
}
