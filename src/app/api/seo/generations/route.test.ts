import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { seoGeneration: { findMany: m.findMany, findFirst: m.findFirst, deleteMany: m.deleteMany } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1", role: "USER" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
import { DELETE, GET } from "./route";

const at = (query = "") => new NextRequest("http://localhost/api/seo/generations" + query);
beforeEach(() => vi.clearAllMocks());

describe("/api/seo/generations", () => {
  it("lists only the signed-in user's results, without their bodies", async () => {
    m.findMany.mockResolvedValue([{ id: "g1" }]);
    const body = await (await GET(at())).json();
    expect(body.generations).toEqual([{ id: "g1" }]);
    const query = m.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: "u1" });
    expect(query.select.output).toBeUndefined();
  });

  it("never opens another user's result", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await GET(at("?id=other"))).status).toBe(404);
    expect(m.findFirst.mock.calls[0][0].where).toEqual({ id: "other", userId: "u1" });
  });

  it("deletes only the user's own result", async () => {
    m.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(at("?id=other"))).status).toBe(404);
    expect(m.deleteMany.mock.calls[0][0].where).toEqual({ id: "other", userId: "u1" });
  });
});
