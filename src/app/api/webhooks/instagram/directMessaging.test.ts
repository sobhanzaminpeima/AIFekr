import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";

const prefix = `ig-direct-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const secret = "test-instagram-webhook-secret";
const userId = `${prefix}-user`;
const igUserId = `${prefix}-account`;
const senderId = `${prefix}-sender`;
let previousSecret: string | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let sentPayloads: Array<Record<string, unknown>> = [];

function signedRequest(payload: unknown) {
  const rawBody = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return new NextRequest("https://aifekr.test/api/webhooks/instagram", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body: rawBody,
  });
}

async function deliverMessage(mid: string) {
  return POST(signedRequest({
    object: "instagram",
    entry: [{ id: igUserId, messaging: [{ sender: { id: senderId }, message: { mid, text: "hello" } }] }],
  }));
}

async function deliverPostback(payload: string) {
  return POST(signedRequest({
    object: "instagram",
    entry: [{ id: igUserId, messaging: [{ sender: { id: senderId }, postback: { payload } }] }],
  }));
}

async function deliverComment(commentId: string, mediaId: string, text = "aifekr") {
  return POST(signedRequest({
    object: "instagram",
    entry: [{
      id: igUserId,
      changes: [{
        field: "comments",
        value: { id: commentId, text, from: { id: senderId, username: "tester" }, media: { id: mediaId } },
      }],
    }],
  }));
}

beforeEach(async () => {
  previousSecret = process.env.INSTAGRAM_APP_SECRET;
  process.env.INSTAGRAM_APP_SECRET = secret;
  sentPayloads = [];
  fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.body) sentPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  await prisma.user.create({ data: { id: userId, email: `${prefix}@example.test`, plan: "PRO", credits: 1000 } });
  await prisma.instagramConnection.create({ data: {
    userId, businessId: `${prefix}-business`, igUserId, igUsername: "aifekr_test", pageId: `${prefix}-page`, accessToken: "test-token",
  } });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (previousSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET;
  else process.env.INSTAGRAM_APP_SECRET = previousSecret;
  await prisma.instagramDirectMessageLog.deleteMany({ where: { userId } });
  await prisma.instagramDirectRule.deleteMany({ where: { userId } });
  await prisma.instagramCommentReplyLog.deleteMany({ where: { userId } });
  await prisma.instagramCommentCampaign.deleteMany({ where: { userId } });
  await prisma.instagramConnection.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => prisma.$disconnect());

describe("Instagram Auto Direct webhook delivery", () => {
  it("sends a matching fixed reply once and records the delivered payload", async () => {
    await prisma.instagramDirectRule.create({ data: {
      userId, businessId: `${prefix}-business`, name: "Hello", triggerType: "keyword", keywords: "hello", response: "Welcome to AIFekr",
    } });

    const response = await deliverMessage(`${prefix}-message-1`);

    expect(response.status).toBe(200);
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].message).toEqual({ text: "Welcome to AIFekr" });
    const log = await prisma.instagramDirectMessageLog.findUniqueOrThrow({ where: { eventId: `${prefix}-message-1` } });
    expect(log.status).toBe("sent");
    expect(log.replyText).toBe("Welcome to AIFekr");

    await deliverMessage(`${prefix}-message-1`);
    expect(sentPayloads).toHaveLength(1);
  });

  it("sends the comment-to-DM campaign for its selected post only", async () => {
    const businessId = `${prefix}-business`;
    await prisma.instagramCommentCampaign.create({ data: {
      userId,
      businessId,
      keyword: "aifekr",
      postId: "target-post",
      dmMessage: "Here is the offer for this post: https://aifekr.test/offer",
      publicReplyMessage: "Please check your DMs",
    } });

    await deliverComment(`${prefix}-wrong-post-comment`, "another-post");
    expect(sentPayloads).toHaveLength(0);
    expect((await prisma.instagramCommentReplyLog.findUniqueOrThrow({ where: { commentId: `${prefix}-wrong-post-comment` } })).status).toBe("no_match");

    await deliverComment(`${prefix}-matching-comment`, "target-post");
    expect(sentPayloads).toHaveLength(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`/${prefix}-matching-comment/private_replies`);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      message: "Here is the offer for this post: https://aifekr.test/offer",
      access_token: "test-token",
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain(`/${prefix}-matching-comment/replies`);
    expect((await prisma.instagramCommentReplyLog.findUniqueOrThrow({ where: { commentId: `${prefix}-matching-comment` } })).status).toBe("sent");

    await deliverComment(`${prefix}-matching-comment`, "target-post");
    expect(sentPayloads).toHaveLength(2);
  });

  it("never publishes private campaign content when Meta rejects the private reply", async () => {
    await prisma.instagramCommentCampaign.create({ data: {
      userId,
      businessId: `${prefix}-business`,
      keyword: "aifekr",
      postId: "target-post",
      dmMessage: "PRIVATE OFFER https://aifekr.test/secret",
      publicReplyMessage: "Please check your DMs",
    } });
    fetchMock
      .mockImplementationOnce(async (_input: string | URL | Request, init?: RequestInit) => {
        if (init?.body) sentPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ error: { message: "permission denied" } }), { status: 403 });
      })
      .mockImplementationOnce(async (_input: string | URL | Request, init?: RequestInit) => {
        if (init?.body) sentPayloads.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      });

    await deliverComment(`${prefix}-rejected-comment`, "target-post");

    expect(sentPayloads).toHaveLength(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/private_replies");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/replies");
    expect(sentPayloads[1].message).toBe("Please check your DMs");
    expect(JSON.stringify(sentPayloads[1])).not.toContain("PRIVATE OFFER");
    expect(JSON.stringify(sentPayloads[1])).not.toContain("/secret");
    const log = await prisma.instagramCommentReplyLog.findUniqueOrThrow({ where: { commentId: `${prefix}-rejected-comment` } });
    expect(log.status).toBe("failed");
    expect(log.error).toContain("permission denied");
  });

  it("holds a gated reply until its signed postback and prevents repeated unlocks", async () => {
    const rule = await prisma.instagramDirectRule.create({ data: {
      userId, businessId: `${prefix}-business`, name: "Gated hello", triggerType: "keyword", keywords: "hello", response: "Gated payload",
      followGateEnabled: true, typingIndicatorEnabled: true, delayMinSeconds: 0, delayMaxSeconds: 0,
    } });

    await deliverMessage(`${prefix}-message-2`);
    const log = await prisma.instagramDirectMessageLog.findUniqueOrThrow({ where: { eventId: `${prefix}-message-2` } });
    expect(log.status).toBe("awaiting_follow");
    expect(sentPayloads.some((payload) => payload.sender_action === "typing_on")).toBe(true);
    expect(sentPayloads.some((payload) => (payload.message as { attachment?: { payload?: { buttons?: Array<{ payload: string }> } } })?.attachment?.payload?.buttons?.[0]?.payload === `DIRECT_FOLLOW_CONFIRM:${log.id}`)).toBe(true);
    expect(sentPayloads.some((payload) => (payload.message as { text?: string })?.text === "Gated payload")).toBe(false);

    await deliverPostback(`DIRECT_FOLLOW_CONFIRM:${log.id}`);
    expect((await prisma.instagramDirectMessageLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe("sent");
    expect(sentPayloads.filter((payload) => (payload.message as { text?: string })?.text === "Gated payload")).toHaveLength(1);

    await deliverPostback(`DIRECT_FOLLOW_CONFIRM:${log.id}`);
    expect(sentPayloads.filter((payload) => (payload.message as { text?: string })?.text === "Gated payload")).toHaveLength(1);
    expect((await prisma.instagramDirectRule.findUniqueOrThrow({ where: { id: rule.id } })).triggerCount).toBe(1);
  });
});
