import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/jwt";
import { ledgerDrift } from "@/lib/credits/ledger";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { hasBusinessBundle } from "@/lib/plans/businessAccess";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";
import { PATCH } from "@/app/api/admin/payments/[id]/route";
import { reviewBankPayment, settleVerifiedPayment } from "./reviewBankPayment";

/** The paths a paid order takes after checkout, on a real (isolated) database. */
describe.runIf(process.env.RUN_BANK_INTEGRATION === "1")("purchase journey", () => {
  const users: string[] = [];
  let admin: string;
  let serial = 0;

  beforeAll(async () => {
    if (process.env.DATABASE_URL !== "file:./vitest.db") throw new Error("Isolated integration database required");
    await prisma.industryPack.upsert({ where: { slug: "university" }, update: {}, create: { slug: "university", name: "دانشگاه / مدرسه", nameEn: "University / School", emoji: "🎓", tagline: "", valueProposition: "", targetCustomers: "[]", painPoints: "[]", agents: "[]", outcomes: "[]", kpis: "[]", color: "#6366f1", gradientFrom: "#312e81", gradientTo: "#6366f1" } });
    admin = (await newUser({ role: "ADMIN" })).id;
  });
  afterEach(() => { vi.useRealTimers(); });
  afterAll(async () => {
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: users } } });
    await prisma.payment.deleteMany({ where: { userId: { in: users } } });
    await prisma.userModuleOverride.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  async function newUser(data: Record<string, unknown> = {}) {
    const user = await prisma.user.create({ data: { email: `journey-${Date.now()}-${++serial}@test.invalid`, credits: 0, ...data } });
    users.push(user.id);
    return user;
  }
  type Order = { months?: number; days?: number; credits?: number; gateway?: string; authority?: string; receipt?: boolean; status?: string };
  function order(userId: string, plan: string, o: Order = {}) {
    const months = o.months ?? 1;
    return prisma.payment.create({ data: { userId, plan, status: o.status ?? "PENDING", gateway: o.gateway ?? "bank_transfer", authority: o.authority, amount: 10000, transferMinor: 98286, transferCurrency: "TRY", periodMonths: months, receiptAt: o.receipt === false ? null : new Date(), entitlementSnapshot: JSON.stringify({ credits: o.credits ?? 1000, days: o.days ?? months * 30 }) } });
  }
  const at = (iso: string) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(iso)); };
  const account = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });
  const student = (id: string) => isStudentWorkspaceEnabled({ id });
  const drift = async (id: string) => (await ledgerDrift(prisma)).find((w) => w.userId === id && !w.teamId)?.drift;
  const review = (id: string, action: string, cookie?: string) => PATCH(new NextRequest(`http://localhost/api/admin/payments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", origin: "http://localhost", ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ action, note: "Bank statement checked" }) }), { params: Promise.resolve({ id }) });

  it("a month ends one calendar month later, clamped at month end, and access stops exactly there", async () => {
    at("2027-01-31T10:00:00.000Z");
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    await reviewBankPayment(p.id, admin, true, "Verified");
    expect((await account(u.id)).planExpiry?.toISOString()).toBe("2027-02-28T10:00:00.000Z");
    at("2027-02-28T09:59:59.000Z");
    expect(await student(u.id)).toBe(true);
    at("2027-02-28T10:00:00.000Z");
    expect(await student(u.id)).toBe(false);
  });

  it("three months end three calendar months later", async () => {
    at("2026-11-30T08:00:00.000Z");
    const u = await newUser();
    const p = await order(u.id, "STUDENT_FIRST_THREE_MONTHS", { months: 3 });
    await reviewBankPayment(p.id, admin, true, "Verified");
    expect((await account(u.id)).planExpiry?.toISOString()).toBe("2027-02-28T08:00:00.000Z");
  });

  it("a renewal adds its months after the current expiry", async () => {
    at("2027-03-01T00:00:00.000Z");
    const u = await newUser({ plan: "STUDENT_MONTHLY", accountType: "STUDENT", planExpiry: new Date("2027-03-15T12:00:00.000Z") });
    const p = await order(u.id, "STUDENT_MONTHLY");
    await reviewBankPayment(p.id, admin, true, "Verified");
    expect((await account(u.id)).planExpiry?.toISOString()).toBe("2027-04-15T12:00:00.000Z");
  });

  it("an expired Student account regains access only through a new verified payment, counted from now", async () => {
    at("2027-05-10T09:00:00.000Z");
    const u = await newUser({ plan: "STUDENT_MONTHLY", accountType: "STUDENT", planExpiry: new Date("2027-05-01T00:00:00.000Z") });
    expect(await student(u.id)).toBe(false);
    expect(await isModuleEnabled({ id: u.id, role: "USER", industryPackId: null }, "student.workspace")).toBe(false);
    const p = await order(u.id, "STUDENT_MONTHLY");
    expect(await student(u.id)).toBe(false);
    await reviewBankPayment(p.id, admin, true, "Verified");
    expect((await account(u.id)).planExpiry?.toISOString()).toBe("2027-06-10T09:00:00.000Z");
    expect(await student(u.id)).toBe(true);
  });

  it("a Student purchase opens Student and nothing unrelated", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    await reviewBankPayment(p.id, admin, true, "Verified");
    const after = await account(u.id);
    expect(after.plan).toBe("STUDENT_MONTHLY");
    expect(after.accountType).toBe("STUDENT");
    expect(after.credits).toBe(1000);
    expect(await drift(u.id)).toBe(0);
    expect(await student(u.id)).toBe(true);
    expect(after.crmPlan).toBe("NONE");
    expect(after.voicePlan).toBe("NONE");
    expect(await hasBusinessBundle(u.id)).toBe(false);
    const access = { id: u.id, role: "USER", industryPackId: null };
    expect(await isModuleEnabled(access, "crm.property")).toBe(false);
    expect(await isModuleEnabled(access, "agent.voiceCallCenter")).toBe(false);
  });

  it("a Student purchase keeps separately paid CRM and voice subscriptions", async () => {
    const crmExpiry = new Date(Date.now() + 40 * 86400000), voiceExpiry = new Date(Date.now() + 20 * 86400000);
    const u = await newUser({ crmPlan: "SOLO", crmPlanExpiry: crmExpiry, voicePlan: "ACTIVE", voicePlanExpiry: voiceExpiry });
    const p = await order(u.id, "STUDENT_MONTHLY");
    await reviewBankPayment(p.id, admin, true, "Verified");
    const after = await account(u.id);
    expect([after.crmPlan, after.crmPlanExpiry, after.voicePlan, after.voicePlanExpiry]).toEqual(["SOLO", crmExpiry, "ACTIVE", voiceExpiry]);
    expect(await student(u.id)).toBe(true);
  });

  it("a receipt alone activates nothing, and a rejected transfer never does", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    expect((await account(u.id)).plan).toBe("FREE");
    expect(await student(u.id)).toBe(false);
    await reviewBankPayment(p.id, admin, false, "Transfer not found");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect([row.status, row.reviewBy, row.reviewNote]).toEqual(["REJECTED", admin, "Transfer not found"]);
    expect(row.reviewAt).toBeInstanceOf(Date);
    const after = await account(u.id);
    expect([after.plan, after.planExpiry, after.credits]).toEqual(["FREE", null, 0]);
    await expect(reviewBankPayment(p.id, admin, true, "")).rejects.toThrow("ALREADY_REVIEWED");
    expect(await student(u.id)).toBe(false);
  });

  it("records who approved a transfer and when", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    await reviewBankPayment(p.id, admin, true, "Statement line 12");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect([row.status, row.reviewBy, row.reviewNote, row.refId]).toEqual(["SUCCESS", admin, "Statement line 12", `BANK-${p.id}`]);
    expect(row.reviewAt).toBeInstanceOf(Date);
  });

  it("two simultaneous approvals activate and credit once", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    const results = await Promise.allSettled([reviewBankPayment(p.id, admin, true, "a"), reviewBankPayment(p.id, admin, true, "b")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await account(u.id)).credits).toBe(1000);
    expect(await drift(u.id)).toBe(0);
  });

  it("a duplicate Zarinpal callback changes nothing and a foreign authority is refused", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY", { gateway: "zarinpal", authority: "A-journey", receipt: false });
    await expect(settleVerifiedPayment(p.id, "A-other", "1")).rejects.toThrow("NOT_REVIEWABLE");
    expect((await account(u.id)).plan).toBe("FREE");
    expect(await settleVerifiedPayment(p.id, "A-journey", "777")).toBe(true);
    const first = await account(u.id);
    expect(await settleVerifiedPayment(p.id, "A-journey", "777")).toBe(false);
    const second = await account(u.id);
    expect([second.credits, second.planExpiry]).toEqual([first.credits, first.planExpiry]);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).refId).toBe("777");
    expect(await drift(u.id)).toBe(0);
  });

  it("a failed gateway order cannot be settled afterwards", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY", { gateway: "zarinpal", authority: "A-failed", receipt: false, status: "FAILED" });
    await expect(settleVerifiedPayment(p.id, "A-failed", "1")).rejects.toThrow("ALREADY_REVIEWED");
    expect((await account(u.id)).plan).toBe("FREE");
  });

  it("only an administrator can approve through the API", async () => {
    const u = await newUser();
    const p = await order(u.id, "STUDENT_MONTHLY");
    expect((await review(p.id, "approve")).status).toBe(403);
    const buyerCookie = `token=${signToken({ userId: u.id, role: "USER", plan: "FREE" })}`;
    expect((await review(p.id, "approve", buyerCookie)).status).toBe(403);
    // A forged role in the token is not trusted: the role comes from the database.
    const forged = `token=${signToken({ userId: u.id, role: "SUPER_ADMIN", plan: "FREE" })}`;
    expect((await review(p.id, "approve", forged)).status).toBe(403);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    expect((await account(u.id)).plan).toBe("FREE");
    const adminCookie = `token=${signToken({ userId: admin, role: "ADMIN", plan: "FREE" })}`;
    expect((await review(p.id, "approve", adminCookie)).status).toBe(200);
    expect((await account(u.id)).plan).toBe("STUDENT_MONTHLY");
  });
});
