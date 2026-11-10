import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ user: null as null | { id: string; plan: string; role: string }, profile: vi.fn(), status: vi.fn(), subscribe: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => m.user, unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/organization/activeBusiness", () => ({ activeBusinessIdFor: async () => null }));
vi.mock("@/lib/instagram", () => ({ getInstagramProfile: m.profile, getInstagramWebhookSubscription: m.status, subscribeToInstagramWebhooks: m.subscribe }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    instagramConnection: { findFirst: async () => ({ igUserId: "ig1", igUsername: "shop", accessToken: "secret-token", tokenExpiry: null, createdAt: new Date("2026-11-01") }) },
    instagramDirectMessageLog: { findFirst: async () => ({ createdAt: new Date("2026-11-09") }) },
    instagramCommentReplyLog: { findFirst: async () => ({ createdAt: new Date("2026-11-08"), status: "sent" }) },
  },
}));
import { GET, POST } from "./route";

const request = (method: string) => new NextRequest("http://localhost/api/social/instagram/webhooks/subscribe", { method });

describe("Instagram event health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.profile.mockResolvedValue({ userId: "ig1" });
    m.status.mockResolvedValue({ subscribed: true, fields: ["comments"] });
    m.subscribe.mockResolvedValue(undefined);
  });

  it("requires a signed-in user", async () => {
    m.user = null;
    expect((await GET(request("GET")))!.status).toBe(401);
  });

  it("lets the connection owner run the check on any plan, without exposing the token", async () => {
    m.user = { id: "u1", plan: "STUDENT_QUARTERLY", role: "USER" };
    const response = (await GET(request("GET")))!;
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("secret-token");
    expect(JSON.parse(text)).toMatchObject({ tokenValid: true, subscribed: true, lastEventAt: "2026-11-09T00:00:00.000Z", lastDeliveryResult: "sent" });
  });

  it("reports a failing Meta call in the result", async () => {
    m.user = { id: "u1", plan: "FREE", role: "USER" };
    m.profile.mockRejectedValue(new Error("expired"));
    m.status.mockRejectedValue(new Error("expired"));
    const body = await (await GET(request("GET")))!.json();
    expect(body).toMatchObject({ tokenValid: false, subscribed: false, subscriptionChecked: false });
  });

  it("keeps enabling events behind the plan for ordinary users", async () => {
    m.user = { id: "u1", plan: "STUDENT_QUARTERLY", role: "USER" };
    expect((await POST(request("POST")))!.status).toBe(403);
    expect(m.subscribe).not.toHaveBeenCalled();
  });

  it("lets an administrator enable events whatever their own plan", async () => {
    m.user = { id: "a1", plan: "STUDENT_QUARTERLY", role: "SUPER_ADMIN" };
    expect((await POST(request("POST")))!.status).toBe(200);
    expect(m.subscribe).toHaveBeenCalledOnce();
  });

  it("still allows a paying user", async () => {
    m.user = { id: "u2", plan: "PRO", role: "USER" };
    expect((await POST(request("POST")))!.status).toBe(200);
  });
});
