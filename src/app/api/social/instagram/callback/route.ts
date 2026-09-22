export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { exchangeCodeForToken, getLongLivedToken, getInstagramProfile, subscribeToCommentWebhooks } from "@/lib/instagram";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // we passed the user id as OAuth state
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/social?instagram=failed`);
  }

  try {
    const businessId = await activeBusinessIdFor(userId);
    const redirectUri = `${appUrl}/api/social/instagram/callback`;
    const { token: shortToken } = await exchangeCodeForToken(code, redirectUri);
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken);
    // The token-exchange `user_id` is NOT the id webhooks and Graph `/{id}`
    // use — resolve the real IG User ID from /me, or comment→DM automations
    // never match an inbound event.
    const profile = await getInstagramProfile(longToken);
    const igUserId = profile.userId;
    const igUsername = profile.username;

    // Switching to a different IG account (without an explicit disconnect
    // first) must not leave the previous account's campaigns, trigger logs,
    // follower history or auto-publish queue attached to the new one.
    const prev = await prisma.instagramConnection.findFirst({ where: { userId, ...bizScope(businessId) } });
    if (prev && prev.igUserId !== igUserId) {
      const camps = await prisma.instagramCommentCampaign.findMany({ where: { userId }, select: { id: true } });
      await prisma.$transaction([
        prisma.instagramCommentReplyLog.deleteMany({ where: { OR: [{ userId }, { campaignId: { in: camps.map((c) => c.id) } }] } }),
        prisma.instagramCommentCampaign.deleteMany({ where: { userId } }),
        prisma.instagramFollowerSnapshot.deleteMany({ where: { userId } }),
        prisma.scheduledPost.deleteMany({ where: { userId, ...bizScope(businessId) } }),
      ]);
    }

    // SQLite treats NULL as distinct in a unique index, so upsert's compound key
    // ("userId_businessId") cannot match a NULL businessId -- find/update/create instead.
    if (prev) {
      await prisma.instagramConnection.update({
        where: { id: prev.id },
        data: { igUserId, igUsername, pageId: igUserId, accessToken: longToken, tokenExpiry: new Date(Date.now() + expiresIn * 1000) },
      });
    } else {
      await prisma.instagramConnection.create({
        data: { userId, businessId, igUserId, igUsername, pageId: igUserId, accessToken: longToken, tokenExpiry: new Date(Date.now() + expiresIn * 1000) },
      });
    }

    // Best-effort — a failure here shouldn't block the connection itself,
    // it would just mean comment auto-reply campaigns silently don't fire
    // until the user reconnects or an admin re-runs this subscription.
    await subscribeToCommentWebhooks(igUserId, longToken).catch((e) => {
      console.error("Instagram comment webhook subscription failed:", e);
    });

    return NextResponse.redirect(`${appUrl}/social?instagram=connected`);
  } catch (e) {
    console.error("Instagram OAuth callback error:", e);
    return NextResponse.redirect(`${appUrl}/social?instagram=failed`);
  }
}
