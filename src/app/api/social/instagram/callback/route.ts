export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {requireAuth} from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { exchangeCodeForToken, getLongLivedToken, getInstagramProfile, subscribeToInstagramWebhooks, InstagramApiError } from "@/lib/instagram";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { classifyOwnership, releaseInstagramConnection, workspaceSlotTaken } from "@/lib/instagram/ownership";
import { getInstagramRedirectUri, resolveInstagramAppUrl } from "@/lib/instagram/urls";

/** Why a connection failed; shown to the user and logged. Never contains a token, code, state or secret. */
type FailReason = "denied" | "session_expired" | "state_mismatch" | "account_mismatch" | "missing_code" | "token_exchange" | "long_lived_token" | "profile" | "connected_other_account" | "connected_other_workspace" | "save_failed" | "workspace_has_account";

function failed(appUrl: string, reason: FailReason, detail: Record<string, unknown> = {}) {
  console.error("[instagram-oauth]", JSON.stringify({ reason, ...detail }));
  const response = NextResponse.redirect(`${appUrl}/social?instagram=failed&reason=${reason}`);
  response.cookies.set("ig_oauth_pending", "", { path: "/api/social/instagram", maxAge: 0 });
  return response;
}

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

  const currentUser = await requireAuth(req);
  // Each pre-check fails with its own reason (previously one silent branch).
  if (error) return failed(appUrl, "denied", { metaError: error.slice(0, 40), metaReason: searchParams.get("error_reason")?.slice(0, 40) ?? null });
  if (!pending || !userId) return failed(appUrl, "session_expired", { cookie: req.cookies.has("ig_oauth_pending") });
  if (!state || state !== pending.state) return failed(appUrl, "state_mismatch");
  if (currentUser?.id !== userId) return failed(appUrl, "account_mismatch", { signedIn: !!currentUser });
  if (!code) return failed(appUrl, "missing_code");

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

    const others = await prisma.instagramConnection.findMany({
      where: { igUserId, NOT: { userId, businessId } },
      select: { id: true, userId: true, businessId: true, tokenExpiry: true },
    });
    const ownership = classifyOwnership(others, userId);
    if (ownership.kind === "other_account" || ownership.kind === "other_workspace") {
      return failed(appUrl, ownership.kind === "other_account" ? "connected_other_account" : "connected_other_workspace", { userId });
    }
    // Meta has just proved this user controls the account, and no one else holds a working token for it.
    if (ownership.kind === "stale") for (const id of ownership.connectionIds) await releaseInstagramConnection(id, userId, "stale_reclaim");

    const prev = await prisma.instagramConnection.findFirst({ where: { userId, ...instagramWorkspaceScope(businessId) } });
    // A different account never replaces the connected one implicitly: that
    // deleted the old account's campaigns and queue without asking.
    if (workspaceSlotTaken(prev, igUserId)) return failed(appUrl, "workspace_has_account", { userId });
    // Kept for safety should the guard above ever change: a switch must not
    // leave the previous account's data attached to the new one.
    if (prev && prev.igUserId !== igUserId) {
      const camps = await prisma.instagramCommentCampaign.findMany({ where: { userId, ...instagramWorkspaceScope(businessId) }, select: { id: true } });
      await prisma.$transaction([
        // Reply logs may carry only a campaignId (userId is optional), so
        // they are matched by the campaigns being removed as well.
        prisma.instagramCommentReplyLog.deleteMany({ where: { OR: [{ userId, businessId }, { campaignId: { in: camps.map((c) => c.id) } }] } }),
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
    if (e instanceof InstagramApiError) return failed(appUrl, e.stage, { userId, message: e.message.slice(0, 160), ...e.meta });
    return failed(appUrl, "save_failed", { userId, message: e instanceof Error ? e.message.slice(0, 160) : "unknown" });
  }
}
