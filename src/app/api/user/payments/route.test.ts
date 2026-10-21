import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), count: vi.fn(), packages: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: mocks.auth, unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { payment: { findMany: mocks.find, count: mocks.count }, package: { findMany: mocks.packages } } }));
import { GET } from "./route";

const row = { id: "order-one", plan: "STUDENT_FIRST_THREE_MONTHS", status: "PENDING", gateway: "bank_transfer", receiptAt: "2026-10-05T08:00:00Z", bankSnapshot: '{"iban":"private account"}' };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: "student-one", featureAccess: false });
  mocks.find.mockResolvedValue([row]); mocks.count.mockResolvedValue(1);
  mocks.packages.mockResolvedValue([{ planCode: row.plan, name: "دانشجو", nameEn: "Student" }]);
});

describe("account payment history", () => {
  it("keeps payment recovery available without feature entitlement and scopes every query to the signed-in user", async () => {
    const response = await GET(new NextRequest("https://aifekr.test/api/user/payments?filter=pending&page=2"));
    expect(response.status).toBe(200);
    expect(mocks.find.mock.calls[0][0].where).toEqual({ userId: "student-one", status: { in: ["PENDING"] } });
    expect(mocks.find.mock.calls[0][0].skip).toBe(30);
    for (const [args] of mocks.count.mock.calls) expect(args.where.userId).toBe("student-one");
    const data = await response.json();
    expect(data.payments[0].receiptAt).toBe(row.receiptAt);
    expect(data.payments[0].bankSnapshot).toBeUndefined();
    expect(data.payments[0].resumeUrl).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("paginates without hiding older payment records", async () => {
    mocks.find.mockResolvedValue(Array.from({ length: 31 }, (_, i) => ({ ...row, id: `order-${i}` })));
    const data = await (await GET(new NextRequest("https://aifekr.test/api/user/payments"))).json();
    expect(data.payments).toHaveLength(30); expect(data.hasMore).toBe(true);
  });
  it("never offers a new gateway checkout for a closed payment", async () => {
    mocks.find.mockResolvedValue([{ ...row, gateway: "zarinpal", status: "SUCCESS", bankSnapshot: '{"paymentUrl":"https://www.zarinpal.com/pg/StartPay/A123"}' }]);
    const data = await (await GET(new NextRequest("https://aifekr.test/api/user/payments"))).json();
    expect(data.payments[0].resumeUrl).toBeNull();
  });
  it("does not expose any history anonymously", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(new NextRequest("https://aifekr.test/api/user/payments"))).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.count).not.toHaveBeenCalled();
  });
});
