export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { exchangeCodeForToken, getLongLivedToken, getInstagramProfile, subscribeToInstagramWebhooks } from "@/lib/instagram";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { getInstagramRedirectUri, resolveInstagramAppUrl } from "@/lib/instagram/urls";

export async function GET(req: NextRequest) {
  const appUrl = resolveInstagramAppUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === "production");
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  let pending: { state: string; userId: string; businessId: string | null } | null = null;
  try {
    const encoded = req.cookies.get("ig_oauth_pending")?.value;
    const [payload, signature] = encoded?.split(".") || [];
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.INSTAGRAM_APP_SECRET || "";
    if (payload && signature && secret) {
      const expected = crypto.createHmac("sha256", secret).update(payload).digest();
      const actual = Buffer.from(signature, "base64url");
      if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
        pending = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      }
    }
  } catch {}
  const userId = pending?.userId;
  const businessId = pending?.businessId ?? null;

  if (error || !code || !userId || !state || state !== pending?.state) {
    const response = NextResponse.redirect(`${appUrl}/social?instagram=failed`);
    response.cookies.set("ig_oauth_pending", "", { path: "/api/social/instagram", maxAge: 0 });
    return response;
  }

  try {
    const redirectUri = getInstagramRedirectUri();
    const { token: shortToken } = await exchangeCodeForToken(code, redirectUri);
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken);
    // The token-exchange `user_id` is NOT the id webhooks and Graph `/{id}`
    // use — resolve the real IG User ID from /me, or comment→DM automations
    // never match an inbound event.
    const profile = await getInstagramProfile(longToken);
    const igUserId = profile.userId;
    const igUsername = profile.username;

    const sameInstagramElsewhere = await prisma.instagramConnection.findFirst({
      where: { igUserId, NOT: { userId, businessId } },
      select: { id: true },
    });
    if (sameInstagramElsewhere) {
      throw new Error("این حساب اینستاگرام قبلاً به فضای کاری دیگری متصل شده است");
    }

    // Switching to a different IG account (without an explicit disconnect
    // first) must not leave the previous account's campaigns, trigger logs,
    // follower history or auto-publish queue attached to the new one.
    const prev = await prisma.instagramConnection.findFirst({ where: { userId, ...instagramWorkspaceScope(businessId) } });
    if (prev && prev.igUserId !== igUserId) {
      const camps = await prisma.instagramCommentCampaign.findMany({ where: { userId, ...instagramWorkspaceScope(businessId) }, select: { id: true } });
      await prisma.$transaction([
        prisma.instagramCommentReplyLog.deleteMany({ where: { userId, businessId } }),
        prisma.instagramCommentCampaign.deleteMany({ where: { userId, ...instagramWorkspaceScope(businessId) } }),
        prisma.instagramDirectMessageLog.deleteMany({ where: { userId, businessId } }),
        prisma.instagramFollowerSnapshot.deleteMany({ where: { userId, ...instagramWorkspaceScope(businessId) } }),
        prisma.scheduledPost.deleteMany({ where: { userId, businessId } }),
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
    // it would just mean Auto Direct and comment rules silently don't fire
    // until the user reconnects or an admin re-runs this subscription.
    await subscribeToInstagramWebhooks(igUserId, longToken).catch((e) => {
      console.error("Instagram webhook subscription failed:", e);
    });

    const response = NextResponse.redirect(`${appUrl}/social?instagram=connected`);
    response.cookies.set("ig_oauth_pending", "", { path: "/api/social/instagram", maxAge: 0 });
    return response;
  } catch (e) {
    console.error("Instagram OAuth callback error:", e);
    const response = NextResponse.redirect(`${appUrl}/social?instagram=failed`);
    response.cookies.set("ig_oauth_pending", "", { path: "/api/social/instagram", maxAge: 0 });
    return response;
  }
}
