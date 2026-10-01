import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createPayment: vi.fn(),
  createPendingPayment: vi.fn(),
  findPaymentById: vi.fn(),
  markPaymentAuthority: vi.fn(),
  markPaymentFailed: vi.fn(),
  activatePlanForPayment: vi.fn(),
  findPackage: vi.fn(),
}));

vi.mock("@/lib/auth/middleware", () => ({ requireAuth: mocks.requireAuth, unauthorizedResponse: () => Response.json({ error: "unauthorized" }, { status: 401 }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: { findUnique: mocks.findPackage }, user: { findUnique: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/payment/zarinpal", () => ({ createPayment: mocks.createPayment }));
vi.mock("@/lib/payment/nowpayments", () => ({ createUsdtInvoice: vi.fn() }));
vi.mock("@/lib/utils/currency", () => ({ getFxRates: vi.fn() }));
vi.mock("@/lib/repositories/paymentRepository", () => ({
  createPendingPayment: mocks.createPendingPayment,
  findPaymentById: mocks.findPaymentById,
  markPaymentAuthority: mocks.markPaymentAuthority,
  markPaymentFailed: mocks.markPaymentFailed,
  activatePlanForPayment: mocks.activatePlanForPayment,
}));

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({ id: "payment-test-user", email: "student@example.test", phone: null });
  mocks.findPackage.mockResolvedValue({ planCode: "TEST_PLAN", isActive: true, market: "BOTH", price: 100_000_000, priceUsd: 1000, credits: 500, duration: 30, crmSeatLimit: 0, teamSeatLimit: 0 });
  mocks.createPendingPayment.mockResolvedValue({ id: "payment-test-row" });
  mocks.findPaymentById.mockResolvedValue({ id: "payment-test-row", userId: "payment-test-user" });
  mocks.createPayment.mockResolvedValue({ ok: true, authority: "sandbox-authority", paymentUrl: "https://sandbox.example.test/pay" });
  mocks.markPaymentAuthority.mockResolvedValue(undefined);
});

describe("POST /api/payment/create", () => {
  it("builds a discounted quarterly checkout without contacting a real gateway in tests", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/payment/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "TEST_PLAN", period: "quarterly", gateway: "zarinpal" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paymentUrl: "https://sandbox.example.test/pay", paymentId: "payment-test-row" });
    expect(mocks.createPendingPayment).toHaveBeenCalledWith({ userId: "payment-test-user", amount: 28_500_000, plan: "TEST_PLAN", gateway: "zarinpal", walletDiscountToman: 0, periodMonths: 3 });
    expect(mocks.createPayment).toHaveBeenCalledOnce();
    expect(mocks.markPaymentAuthority).toHaveBeenCalledWith("payment-test-row", "sandbox-authority");
  });

  it("rejects unauthenticated payment creation before any package or gateway work", async () => {
    mocks.requireAuth.mockResolvedValue(null);
    const response = await POST(new NextRequest("https://aifekr.test/api/payment/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "TEST_PLAN" }) }));
    expect(response.status).toBe(401);
    expect(mocks.createPayment).not.toHaveBeenCalled();
    expect(mocks.createPendingPayment).not.toHaveBeenCalled();
  });
});
