import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ rows: [] as { id: string; authority: string }[], close: vi.fn(), auth: vi.fn(() => true), findMany: vi.fn() }));
vi.mock("@/lib/auth/cronAuth", () => ({ isCronAuthorized: m.auth }));
vi.mock("@/lib/payment/adminLifecycle", () => ({ closeAbandonedGatewayOrder: m.close }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { payment: { findMany: m.findMany } } }));
import { GET } from "./route";

const call = () => GET(new NextRequest("http://localhost/api/cron/zarinpal-reconcile"));
beforeEach(() => { vi.clearAllMocks(); m.auth.mockReturnValue(true); m.findMany.mockImplementation(async () => m.rows); });

it("rejects calls without the cron secret", async () => {
  m.auth.mockReturnValue(false);
  expect((await call()).status).toBe(401);
  expect(m.findMany).not.toHaveBeenCalled();
});
it("checks only old unpaid Zarinpal orders, through the gateway-verified close", async () => {
  m.rows = [{ id: "p1", authority: "A1" }, { id: "p2", authority: "A2" }, { id: "p3", authority: "A3" }];
  m.close.mockResolvedValueOnce("SUCCESS").mockResolvedValueOnce("CANCELLED").mockResolvedValueOnce(null);
  expect(await (await call()).json()).toEqual({ checked: 3, settled: 1, cancelled: 1, unresolved: 1 });
  const where = m.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ gateway: "zarinpal", status: "PENDING" });
  expect(Date.now() - where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
  expect(m.close).toHaveBeenCalledWith("p1", "A1");
});
