import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ conn: vi.fn(), posts: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { instagramConnection: { findFirst: m.conn }, scheduledPost: { findMany: m.posts } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1", role: "USER", plan: "STUDENT_QUARTERLY" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/organization/activeBusiness", () => ({ activeBusinessIdFor: async () => null }));
vi.mock("@/lib/instagram", () => ({ getAccountProfile: m.profile, unsubscribeFromWebhooks: vi.fn() }));
import { GET } from "./route";

const get = (q = "") => GET(new NextRequest("http://localhost/api/social/instagram/status" + q));
const conn = { igUserId: "ig1", accessToken: "t", igUsername: "aifekr", createdAt: new Date("2026-11-01T00:00:00Z"), tokenExpiry: new Date("2027-01-01T00:00:00Z") };

beforeEach(() => { vi.clearAllMocks(); m.posts.mockResolvedValue([]); });

describe("GET /api/social/instagram/status", () => {
  it("returns the live profile, connection date and token expiry for the account card", async () => {
    m.conn.mockResolvedValue(conn);
    m.profile.mockResolvedValue({ username: "aifekr", followersCount: 120 });
    const body = await (await get("?profile=1")).json();
    expect(body.profile).toEqual({ username: "aifekr", followersCount: 120 });
    expect(body.connectedAt).toBe("2026-11-01T00:00:00.000Z");
    expect(body.tokenExpiry).toBe("2027-01-01T00:00:00.000Z");
    expect(body.canAutoPublish).toBe(false);
  });
  it("reports a profile failure instead of showing an empty card", async () => {
    m.conn.mockResolvedValue(conn);
    m.profile.mockRejectedValue(new Error("Invalid OAuth access token"));
    const res = await get("?profile=1");
    expect(res.status).toBe(200);
    expect((await res.json()).profileError).toBe("Invalid OAuth access token");
  });
  it("does not call Instagram for the header's plain status check", async () => {
    m.conn.mockResolvedValue(conn);
    await get();
    expect(m.profile).not.toHaveBeenCalled();
  });
});
