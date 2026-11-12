import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { creditLedgerEntry: { findMany: m.findMany, findFirst: m.findFirst } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
import { GET } from "./route";

const at = (q = "") => GET(new NextRequest("http://localhost/api/user/credit-ledger" + q));
const row = (id: string, teamId: string | null = null) => ({ id, type: "SPEND", delta: -2, balanceAfter: 98, module: "seo.analyze", teamId, createdAt: new Date("2026-11-11T10:00:00Z") });
beforeEach(() => vi.clearAllMocks());

describe("GET /api/user/credit-ledger", () => {
  it("returns only the signed-in user's entries with balance after and receipt id", async () => {
    m.findMany.mockResolvedValue([row("r1"), row("r2", "team1")]);
    const body = await (await at()).json();
    expect(m.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(body.entries[0]).toMatchObject({ id: "r1", delta: -2, balanceAfter: 98, wallet: "personal" });
    expect(body.entries[1].wallet).toBe("team");
    expect(body.entries[0].teamId).toBeUndefined();
    expect(body.next).toBeNull();
  });

  it("pages with a cursor that must belong to the same user", async () => {
    m.findFirst.mockResolvedValue(null);
    m.findMany.mockResolvedValue([]);
    await at("?before=someone-elses");
    expect(m.findFirst.mock.calls[0][0].where).toEqual({ id: "someone-elses", userId: "u1" });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });

  it("offers a next page when there are more rows", async () => {
    m.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => row("r" + i)));
    const body = await (await at()).json();
    expect(body.entries).toHaveLength(50);
    expect(body.next).toBe("r49");
  });
});
