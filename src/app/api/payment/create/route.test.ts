import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findPending: vi.fn(), create: vi.fn(), auth: vi.fn(), findPackage: vi.fn(), membership:vi.fn(), memberCount:vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: mocks.auth, unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/utils/currency", () => ({ getFxRates: async () => ({ usdToToman: 100, usdToTry: 40, usdToEur: 0.9, rateDate: "2026-10-03" }) }));
vi.mock("@/lib/payment/bank", () => ({ bankSettings: async () => ({ iban: "GB82WEST12345698765432", euroIban: "GB82WEST12345698765432", holder: "Test", currency: "TRY" }), validIban: () => true }));
vi.mock("@/lib/payment/bankErrors", () => ({ bankError: (_req: unknown, error: string, status: number) => Response.json({ error }, { status }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  package: { findUnique: mocks.findPackage },
  teamMember:{findUnique:mocks.membership,count:mocks.memberCount},
  $transaction: (fn: (tx: unknown) => unknown) => fn({ payment: { findFirst: mocks.findPending, create: mocks.create } }),
} }));
import { POST } from "./route";

function request(plan: string, period: string, currency = "TRY") {
  return new NextRequest("http://localhost/api/payment/create", { method: "POST", body: JSON.stringify({ plan, period, currency }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "buyer", role: "USER", accountType: "STUDENT" });
  mocks.findPackage.mockResolvedValue({ isActive: true, priceUsd: 8000, price: 80000, credits: 1000, duration: 30, teamSeatLimit:3,crmSeatLimit:3 });
  mocks.membership.mockResolvedValue(null);mocks.memberCount.mockResolvedValue(0);
  mocks.findPending.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "new-payment" });
});
describe("bank checkout period selection", () => {
  it("charges only 80 USD for the new 90-day student offer", async () => {
    expect((await POST(request("STUDENT_FIRST_THREE_MONTHS", "monthly", "EUR"))).status).toBe(200);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.transferMinor).toBe(7200);
    expect(data.periodMonths).toBe(3);
    expect(JSON.parse(data.entitlementSnapshot)).toMatchObject({days:90,credits:1000});
  });
  it("does not multiply the fixed student offer by another billing period", async () => {
    expect((await POST(request("STUDENT_FIRST_THREE_MONTHS", "quarterly"))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not grant another welcome offer after a historical student purchase", async () => {
    mocks.findPending.mockResolvedValueOnce(null).mockResolvedValueOnce({id:"historical-student-payment"});
    expect((await POST(request("STUDENT_FIRST_THREE_MONTHS", "monthly"))).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects null JSON and unsupported currencies without creating an order", async () => {
    const req=new NextRequest("http://localhost/api/payment/create",{method:"POST",body:"null"});
    expect((await POST(req)).status).toBe(400);
    expect((await POST(request("TEAM_BUSINESS_START","monthly","BTC"))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("blocks a member from buying a second owner's workspace", async () => {
    mocks.membership.mockResolvedValue({team:{ownerId:"someone-else"}});
    expect((await POST(request("TEAM_BUSINESS_START", "monthly"))).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a downgrade below the occupied seat count", async () => {
    mocks.memberCount.mockResolvedValue(4);
    expect((await POST(request("TEAM_BUSINESS_START", "monthly"))).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("allocates business credits for every purchased month and snapshots the bundle", async () => {
    await POST(request("TEAM_BUSINESS_GROW", "quarterly"));
    const snapshot = JSON.parse(mocks.create.mock.calls[0][0].data.entitlementSnapshot);
    expect(snapshot).toMatchObject({ credits:3000, days:90, businessBundle:true });
  });
  it("defaults legacy module purchases without a period to one month", async () => {
    const req = new NextRequest("http://localhost/api/payment/create", { method: "POST", body: JSON.stringify({ plan: "VOICE_MONTHLY" }) });
    expect((await POST(req)).status).toBe(200);
    expect(mocks.create.mock.calls[0][0].data.periodMonths).toBe(1);
  });
  it("matches pending orders by buyer, period, currency and payable amount", async () => {
    const response = await POST(request("TEAM_STARTER", "quarterly", "EUR"));
    expect(response.status).toBe(200);
    expect(mocks.findPending).toHaveBeenCalledWith({ where: { userId: "buyer", plan: "TEAM_STARTER", periodMonths: 3, transferCurrency: "EUR", transferMinor: 20520, status: "PENDING", gateway: "bank_transfer" } });
    expect(mocks.create.mock.calls[0][0].data.periodMonths).toBe(3);
    expect(JSON.parse(mocks.create.mock.calls[0][0].data.entitlementSnapshot).days).toBe(90);
  });
  it("uses six months and the correct discount for regular student subscriptions", async () => {
    await POST(request("STUDENT_MONTHLY", "semiannual"));
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.periodMonths).toBe(6);
    expect(data.transferMinor).toBe(1728000);
    expect(JSON.parse(data.entitlementSnapshot).days).toBe(180);
  });
  it("reuses an exact pending order instead of creating a duplicate", async () => {
    mocks.findPending.mockResolvedValue({ id: "same-order" });
    const response = await POST(request("CRM_SOLO", "monthly"));
    expect(await response.json()).toEqual({ paymentId: "same-order", paymentUrl: "/checkout/same-order" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects invalid billing terms before creating an order", async () => {
    expect((await POST(request("TEAM_STARTER", "weekly"))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps unauthenticated purchases blocked", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request("TEAM_STARTER", "monthly"))).status).toBe(401);
    expect(mocks.findPackage).not.toHaveBeenCalled();
  });
});
