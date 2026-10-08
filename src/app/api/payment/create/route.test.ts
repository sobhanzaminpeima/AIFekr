vi.mock("@/lib/utils/referralPromo",()=>({referralDiscount:mocks.promo,applyPromo:(amount:number,percent:number)=>amount*(1-percent/100)}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  promo:vi.fn(), findPending: vi.fn(), create: vi.fn(), auth: vi.fn(), findPackage: vi.fn(), membership:vi.fn(), memberCount:vi.fn(), gateway:vi.fn(),fx:vi.fn(), update:vi.fn(), updateMany:vi.fn(),
}));
vi.mock("@/lib/payment/zarinpal",()=>({createPayment:mocks.gateway}));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: mocks.auth, unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/utils/currency", () => ({ getFxRates:mocks.fx }));
vi.mock("@/lib/payment/bank", () => ({ bankSettings: async () => ({ iban: "TR210001009010583132105001", euroIban: "TR910001009010583132105002", holder: "Test", currency: "EUR" }), validIban: () => true }));
vi.mock("@/lib/payment/bankErrors", () => ({ bankError: (_req: unknown, error: string, status: number) => Response.json({ error }, { status }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  payment:{update:mocks.update,updateMany:mocks.updateMany},
  package: { findUnique: mocks.findPackage },
  teamMember:{findUnique:mocks.membership,count:mocks.memberCount},
  $transaction: (fn: (tx: unknown) => unknown) => fn({ payment: { findFirst: mocks.findPending, create: mocks.create } }),
} }));
import { POST } from "./route";

function request(plan: string, period: string, currency = "TRY") {
  return new NextRequest("http://localhost/api/payment/create", { method: "POST", body: JSON.stringify({ plan, period, currency }) });
}
beforeEach(() => {
  vi.clearAllMocks();mocks.promo.mockResolvedValue({percent:0,code:null});
  mocks.fx.mockResolvedValue({usdToToman:100,usdToTry:40,usdToEur:0.9,rateDate:"2026-10-03"});
  mocks.auth.mockResolvedValue({ id: "buyer", role: "USER", accountType: "STUDENT" });
  mocks.findPackage.mockResolvedValue({ isActive: true, priceUsd: 8000, price: 80000, credits: 1000, duration: 30, teamSeatLimit:3,crmSeatLimit:3 });
  mocks.membership.mockResolvedValue(null);mocks.memberCount.mockResolvedValue(0);
  mocks.findPending.mockResolvedValue(null);
  mocks.gateway.mockResolvedValue({ok:true,authority:"A-test",paymentUrl:"https://www.zarinpal.com/pg/StartPay/A-test"});
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

describe("existing-account student purchase",()=>{
  it("allows explicit student selection on the same account and snapshots its classification",async()=>{
    mocks.auth.mockResolvedValue({id:"existing-buyer",role:"USER",accountType:"PERSONAL"});
    const req=new NextRequest("http://localhost/api/payment/create",{method:"POST",body:JSON.stringify({plan:"STUDENT_FIRST_THREE_MONTHS",period:"monthly",selectStudentAccount:true})});
    expect((await POST(req)).status).toBe(200);
    const data=mocks.create.mock.calls[0][0].data;
    expect(data.userId).toBe("existing-buyer");expect(JSON.parse(data.entitlementSnapshot).accountType).toBe("STUDENT");
  });
  it("does not silently classify a non-student account without explicit selection",async()=>{
    mocks.auth.mockResolvedValue({id:"buyer",role:"USER",accountType:"BUSINESS"});
    expect((await POST(request("STUDENT_FIRST_THREE_MONTHS","monthly"))).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("currency routing",()=>{
 it("routes IRR through Zarinpal with a toman amount and captured entitlements",async()=>{
  const response=await POST(request("TEAM_BUSINESS_GROW","quarterly","IRR"));
  expect(response.status).toBe(200);
  expect((await response.json()).paymentUrl).toContain("zarinpal.com");
  const data=mocks.create.mock.calls[0][0].data;
  expect(data.gateway).toBe("zarinpal");expect(data.transferCurrency).toBe("IRR");
  expect(data.transferMinor).toBe(0);
  expect(mocks.gateway.mock.calls[0][0].amount).toBe(data.amount);
  expect(JSON.parse(data.entitlementSnapshot)).toMatchObject({credits:3000,days:90,businessBundle:true});
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({authority:"A-test"})}));
 });
 it("fails without activating entitlements when the gateway rejects a request",async()=>{
  mocks.gateway.mockResolvedValue({ok:false});
  expect((await POST(request("STUDENT_FIRST_THREE_MONTHS","monthly","IRR"))).status).toBe(503);
  expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"FAILED"}}));
 });
 it("keeps TRY and EUR on bank transfer without calling the gateway",async()=>{
  await POST(request("VOICE_MONTHLY","monthly","TRY"));await POST(request("VOICE_MONTHLY","monthly","EUR"));
  expect(mocks.create.mock.calls.map(c=>c[0].data.transferCurrency)).toEqual(["TRY","EUR"]);
  expect(mocks.gateway).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls.map(c=>JSON.parse(c[0].data.bankSnapshot).iban)).toEqual(["TR210001009010583132105001","TR910001009010583132105002"]);
 });
 it("does not overflow foreign-currency minor storage for large rial subscriptions",async()=>{
  mocks.fx.mockResolvedValue({usdToToman:163000,usdToTry:40,usdToEur:.9});
  mocks.findPackage.mockResolvedValue({isActive:true,priceUsd:69900,price:10000,credits:30000,duration:30,teamSeatLimit:25,crmSeatLimit:25});
  expect((await POST(request("TEAM_BUSINESS_SCALE","quarterly","IRR"))).status).toBe(200);
  const data=mocks.create.mock.calls[0][0].data;expect(data.amount*10).toBeGreaterThan(2147483647);expect(data.transferMinor).toBe(0);expect(mocks.gateway.mock.calls[0][0].amount).toBe(data.amount);
 });

});

it("applies the server promo to EUR without reducing included features",async()=>{mocks.promo.mockResolvedValue({percent:10,code:"influencer"});expect((await POST(request("STUDENT_FIRST_THREE_MONTHS","monthly","EUR"))).status).toBe(200);const data=mocks.create.mock.calls[0][0].data;expect(data.transferMinor).toBe(6480);expect(data.promoPercent).toBe(10);expect(data.originalAmount).toBe(8000);expect(JSON.parse(data.entitlementSnapshot)).toMatchObject({days:90,credits:1000});});
it("applies the server promo to rial gateway requests",async()=>{mocks.promo.mockResolvedValue({percent:10,code:"influencer"});expect((await POST(request("STUDENT_FIRST_THREE_MONTHS","monthly","IRR"))).status).toBe(200);expect(mocks.gateway.mock.calls[0][0].amount).toBe(7200);});
it("prevents multiple pending welcome-discount orders",async()=>{mocks.promo.mockResolvedValue({percent:10,code:"influencer"});mocks.findPending.mockResolvedValueOnce(null).mockResolvedValueOnce({id:"other-promo-order"});expect((await POST(request("STUDENT_FIRST_THREE_MONTHS","monthly","EUR"))).status).toBe(409);expect(mocks.create).not.toHaveBeenCalled();});
