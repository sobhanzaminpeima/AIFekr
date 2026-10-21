import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "instagram-inbox-test-secret"; });

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";

const prefix = `ig-inbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userId = `${prefix}-user`;
const igUserId = `${prefix}-account`;
const recipientId = `${prefix}-recipient`;
const businessId = null;
const requestId = "manual-reply-request-001";
const token = signToken({ userId, role: "USER", plan: "PRO" });
let fetchMock: ReturnType<typeof vitest.fn>;

function makeRequest(body: unknown) {
  return new NextRequest("https://aifekr.test/api/social/instagram/inbox/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  fetchMock = vitest.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
  vitest.stubGlobal("fetch", fetchMock);
  await prisma.user.create({ data: { id: userId, email: `${prefix}@example.test`, plan: "PRO", credits: 100 } });
  await prisma.instagramConnection.create({ data: { userId, businessId, igUserId, igUsername: "test_account", pageId: `${prefix}-page`, accessToken: "test-token" } });
  await prisma.instagramDirectMessageLog.create({
    data: { userId, businessId, eventId: `${prefix}-inbound`, senderId: recipientId, direction: "inbound", text: "Hi", status: "received" },
  });
});

afterEach(async () => {
  vitest.unstubAllGlobals();
  await prisma.instagramDirectMessageLog.deleteMany({ where: { userId } });
  await prisma.instagramConnection.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => prisma.$disconnect());

describe("Instagram Inbox manual reply", () => {
  it("replies only to an initiated conversation and is idempotent for the same request key", async () => {
    const body = { recipientId, text: "Hello from the business", requestId };
    const first = await POST(makeRequest(body));
    expect(first.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).message.text).toBe(body.text);

    const second = await POST(makeRequest(body));
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.instagramDirectMessageLog.count({ where: { userId, direction: "outbound" } })).toBe(1);
  });

  it("rejects a recipient without an inbound conversation", async () => {
    const response = await POST(makeRequest({ recipientId: `${prefix}-unseen`, text: "Hello", requestId }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
