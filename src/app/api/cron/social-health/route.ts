export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/create";
import { isCronAuthorized } from "@/lib/auth/cronAuth";

/**
 * Silent-failure watchdog for the Social module.
 *
 * Comment→DM was broken for roughly four weeks and nothing in the product
 * said so — it was found only because the owner hand-tested it. A feature
 * that receives input and produces zero output must announce itself, not sit
 * there looking enabled. This cron makes that the default for every tenant.
 *
 * Every check is "input arrived AND output is zero", never just "output is
 * zero" — a quiet week with no comments is not a fault.
 */
const DAY = 86400000;

/** Don't re-notify the same condition for the same tenant more than once a day. */
async function alreadyWarned(userId: string, type: string): Promise<boolean> {
  const recent = await prisma.notification.findFirst({
    where: { userId, type, createdAt: { gte: new Date(Date.now() - DAY) } },
    select: { id: true },
  });
  return !!recent;
}

async function warn(userId: string, type: string, title: string, body: string, link = "/social") {
  if (await alreadyWarned(userId, type)) return false;
  await notify(userId, { type, title, body, link });
  return true;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.instagramConnection.findMany();
  const findings: { userId: string; issue: string; notified: boolean }[] = [];
  const now = Date.now();

  for (const conn of connections) {
    const userId = conn.userId;

    // ── 1. Comment→DM campaign receiving comments but sending nothing ────
    try {
      const activeCampaigns = await prisma.instagramCommentCampaign.count({ where: { userId, isActive: true } });
      if (activeCampaigns > 0) {
        const since = new Date(now - 3 * DAY);
        const [commentsSeen, dmsSent] = await Promise.all([
          prisma.instagramCommentReplyLog.count({ where: { userId, createdAt: { gte: since } } }),
          // "sent_public_fallback" counts as delivered too — that's the
          // interim path while instagram_manage_messages awaits App Review;
          // it must not trip the same alarm as a genuinely dead campaign.
          prisma.instagramCommentReplyLog.count({ where: { userId, status: { in: ["sent", "sent_public_fallback"] }, createdAt: { gte: since } } }),
        ]);
        if (commentsSeen > 0 && dmsSent === 0) {
          const notified = await warn(
            userId,
            "social_campaign_silent",
            "پاسخ خودکار کامنت کار نمی‌کند",
            `در ۳ روز گذشته ${commentsSeen} کامنت پردازش شد ولی هیچ دایرکتی ارسال نشد. تنظیمات کمپین و اتصال اینستاگرام را بررسی کنید.`
          );
          findings.push({ userId, issue: "campaign_silent", notified });
        }
      }
    } catch (e) {
      console.error("social-health campaign check failed", userId, e);
    }

    // ── 2. Auto-publish queue stuck ──────────────────────────────────────
    try {
      const stuck = await prisma.scheduledPost.count({
        where: { userId, mode: "auto", status: "PENDING", scheduledFor: { lte: new Date(now - 30 * 60 * 1000) } },
      });
      if (stuck > 0) {
        const notified = await warn(
          userId,
          "social_queue_stuck",
          "پست‌های زمان‌بندی‌شده منتشر نشدند",
          `${stuck} پست از زمان انتشارشان گذشته و هنوز منتشر نشده‌اند.`
        );
        findings.push({ userId, issue: "queue_stuck", notified });
      }
    } catch (e) {
      console.error("social-health queue check failed", userId, e);
    }

    // ── 3. Analytics snapshots stopped (token expired / relay down) ──────
    try {
      const latest = await prisma.instagramFollowerSnapshot.findFirst({
        where: { userId }, orderBy: { date: "desc" }, select: { date: true },
      });
      if (latest && now - latest.date.getTime() > DAY) {
        const notified = await warn(
          userId,
          "social_snapshot_stale",
          "آمار اینستاگرام به‌روز نمی‌شود",
          "بیش از ۲۴ ساعت است آمار فالوور ثبت نشده — احتمالاً توکن اینستاگرام منقضی شده و باید دوباره متصل شوید.",
        );
        findings.push({ userId, issue: "snapshot_stale", notified });
      }
    } catch (e) {
      console.error("social-health snapshot check failed", userId, e);
    }

    // ── 4. Token about to expire ─────────────────────────────────────────
    try {
      if (conn.tokenExpiry && conn.tokenExpiry.getTime() - now < 7 * DAY) {
        const days = Math.max(0, Math.round((conn.tokenExpiry.getTime() - now) / DAY));
        const notified = await warn(
          userId,
          "social_token_expiring",
          "اتصال اینستاگرام به‌زودی منقضی می‌شود",
          `${days} روز تا انقضای توکن باقی مانده. برای جلوگیری از قطع شدن انتشار و پاسخ خودکار، دوباره متصل شوید.`
        );
        findings.push({ userId, issue: "token_expiring", notified });
      }
    } catch (e) {
      console.error("social-health token check failed", userId, e);
    }
  }

  return NextResponse.json({ checked: connections.length, findings });
}
