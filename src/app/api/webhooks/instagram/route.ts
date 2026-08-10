export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { sendPrivateReply, replyToComment, sendTextMessage, sendButtonMessage } from "@/lib/instagram";

// Meta's one-time webhook subscription check (GET with hub.mode=subscribe).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET || "";
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

interface CommentChangeValue {
  id: string; // comment id
  text?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
}

interface MessagingEvent {
  sender?: { id: string };
  postback?: { payload: string };
}

// Meta's own documented cap on private replies — going over it risks the
// connected account getting rate-limited or flagged by Meta.
const HOURLY_SEND_CAP = 750;
const FOLLOW_GATE_PREFIX = "FOLLOW_CONFIRM";

// Meta expects a fast 200 — comment matching here is a plain string check plus
// one or two outbound HTTP calls, cheap enough at this scale (5-10 connected
// accounts) to run inline rather than standing up a queue.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    object?: string;
    entry?: Array<{
      id: string;
      changes?: Array<{ field: string; value: CommentChangeValue }>;
      messaging?: MessagingEvent[];
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "instagram") return NextResponse.json({ ok: true });

  for (const entry of payload.entry || []) {
    const igUserId = entry.id;

    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const comment = change.value;
      if (!comment?.id || !comment.text || !comment.from?.id) continue;

      try {
        await handleComment(igUserId, comment);
      } catch (e) {
        console.error("instagram webhook comment handling error:", e);
      }
    }

    for (const msg of entry.messaging || []) {
      const senderId = msg.sender?.id;
      const postbackPayload = msg.postback?.payload;
      if (!senderId || !postbackPayload?.startsWith(FOLLOW_GATE_PREFIX)) continue;

      try {
        await handleFollowConfirmation(igUserId, senderId, postbackPayload);
      } catch (e) {
        console.error("instagram webhook postback handling error:", e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

interface CampaignLink { id: string; label: string; url: string; clicks: number }

function personalize(text: string, username: string | undefined): string {
  return text.replace(/\{username\}/g, username || "");
}

function buildMessageWithLinks(baseMessage: string, links: CampaignLink[], appUrl: string, campaignId: string): string {
  if (links.length === 0) return baseMessage;
  const lines = links.map((l) => `${l.label}: ${appUrl}/api/social/instagram/campaigns/link?c=${campaignId}&l=${l.id}`);
  return `${baseMessage}\n\n${lines.join("\n")}`;
}

async function handleComment(igUserId: string, comment: CommentChangeValue) {
  const conn = await prisma.instagramConnection.findFirst({ where: { igUserId } });
  if (!conn) return;

  // Never reply to a comment left by the connected account itself (e.g. a
  // reply we or the owner posted manually) — without this a keyword in our
  // own reply text could re-trigger the same campaign.
  if (comment.from!.id === conn.igUserId) return;

  const campaigns = await prisma.instagramCommentCampaign.findMany({
    where: { userId: conn.userId, isActive: true },
  });
  if (campaigns.length === 0) return;

  const commentText = comment.text!.toLowerCase();
  const mediaId = comment.media?.id;

  const matched = campaigns.find((c) => {
    const keywords = c.keyword.split(/[,،]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
    const keywordMatches = keywords.some((k) => commentText.includes(k));
    const postMatches = !c.postId || c.postId === mediaId;
    return keywordMatches && postMatches;
  });
  if (!matched) return;

  // The unique constraint on commentId is the real dedupe guard — this
  // findUnique is just a cheap short-circuit to skip the API calls below.
  const existing = await prisma.instagramCommentReplyLog.findUnique({ where: { commentId: comment.id } });
  if (existing) return;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInLastHour = await prisma.instagramCommentReplyLog.count({
    where: { userId: conn.userId, status: "sent", createdAt: { gte: oneHourAgo } },
  });
  if (sentInLastHour >= HOURLY_SEND_CAP) {
    await prisma.instagramCommentReplyLog.create({
      data: {
        campaignId: matched.id,
        userId: conn.userId,
        commentId: comment.id,
        commenterId: comment.from!.id,
        commenterUsername: comment.from!.username || null,
        status: "skipped",
        error: "rate_limit_750_per_hour",
      },
    }).catch(() => {});
    return;
  }

  const username = comment.from!.username;

  // Follow Gate: withhold the real content behind a self-reported "I
  // followed" button instead of sending it straight away — Meta gives no
  // API to check an arbitrary commenter's follow status.
  if (matched.followGateEnabled) {
    try {
      const prompt = personalize(
        matched.followGatePrompt || "برای دریافت اطلاعات، اول پیج رو فالو کن و بعد دکمه زیر رو بزن 👇",
        username,
      );
      await sendButtonMessage(igUserId, comment.from!.id, conn.accessToken, prompt, "فالو کردم ✅", `${FOLLOW_GATE_PREFIX}:${matched.id}:${comment.id}`);
      await prisma.instagramCommentReplyLog.create({
        data: {
          campaignId: matched.id,
          userId: conn.userId,
          commentId: comment.id,
          commenterId: comment.from!.id,
          commenterUsername: comment.from!.username || null,
          status: "awaiting_follow",
        },
      });
    } catch (e) {
      const isDuplicate = typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) return;
      const msg = e instanceof Error ? e.message : "خطای نامشخص";
      await prisma.instagramCommentReplyLog.create({
        data: {
          campaignId: matched.id,
          userId: conn.userId,
          commentId: comment.id,
          commenterId: comment.from!.id,
          commenterUsername: comment.from!.username || null,
          status: "failed",
          error: msg,
        },
      }).catch(() => {});
    }
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  let links: CampaignLink[] = [];
  try {
    links = matched.links ? JSON.parse(matched.links) : [];
  } catch { links = []; }

  const dmMessage = buildMessageWithLinks(personalize(matched.dmMessage, username), links, appUrl, matched.id);
  const publicReply = matched.publicReplyMessage ? personalize(matched.publicReplyMessage, username) : null;

  try {
    await sendPrivateReply(comment.id, conn.accessToken, dmMessage);
    if (publicReply) {
      await replyToComment(comment.id, conn.accessToken, publicReply).catch(() => {});
    }
    await prisma.instagramCommentReplyLog.create({
      data: {
        campaignId: matched.id,
        userId: conn.userId,
        commentId: comment.id,
        commenterId: comment.from!.id,
        commenterUsername: comment.from!.username || null,
        status: "sent",
      },
    });
    await prisma.instagramCommentCampaign.update({
      where: { id: matched.id },
      data: { triggerCount: { increment: 1 } },
    });
  } catch (e) {
    // Duplicate commentId (P2002) means a retry of an event we already
    // processed — not a real failure, just skip logging it again.
    const isDuplicate = typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    if (isDuplicate) return;

    const msg = e instanceof Error ? e.message : "خطای نامشخص";
    await prisma.instagramCommentReplyLog.create({
      data: {
        campaignId: matched.id,
        userId: conn.userId,
        commentId: comment.id,
        commenterId: comment.from!.id,
        commenterUsername: comment.from!.username || null,
        status: "failed",
        error: msg,
      },
    }).catch(() => {});
  }
}

/** Handles a tap on the Follow Gate's "I followed" button — delivers the real campaign content. */
async function handleFollowConfirmation(igUserId: string, senderId: string, postbackPayload: string) {
  const [, campaignId, commentId] = postbackPayload.split(":");
  if (!campaignId || !commentId) return;

  const log = await prisma.instagramCommentReplyLog.findUnique({ where: { commentId } });
  // Idempotent against double-taps or Meta's own retry delivery of the same postback.
  if (!log || log.status !== "awaiting_follow" || log.campaignId !== campaignId || log.commenterId !== senderId) return;

  const conn = await prisma.instagramConnection.findFirst({ where: { igUserId } });
  const campaign = await prisma.instagramCommentCampaign.findUnique({ where: { id: campaignId } });
  if (!conn || !campaign) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  let links: CampaignLink[] = [];
  try {
    links = campaign.links ? JSON.parse(campaign.links) : [];
  } catch { links = []; }

  const dmMessage = buildMessageWithLinks(personalize(campaign.dmMessage, log.commenterUsername || undefined), links, appUrl, campaign.id);

  try {
    await sendTextMessage(igUserId, senderId, conn.accessToken, dmMessage);
    await prisma.instagramCommentReplyLog.update({ where: { id: log.id }, data: { status: "sent" } });
    await prisma.instagramCommentCampaign.update({ where: { id: campaign.id }, data: { triggerCount: { increment: 1 } } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای نامشخص";
    await prisma.instagramCommentReplyLog.update({ where: { id: log.id }, data: { status: "failed", error: msg } }).catch(() => {});
  }
}
