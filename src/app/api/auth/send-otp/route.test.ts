import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { otpCode: { create: m.create, count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() }, user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/sms/smsir", () => ({ sendOTP: m.send }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true, retryAfterSec: 0 }), getClientIp: () => "1.2.3.4" }));
import { POST } from "./route";

const send = (phone: string) => POST(new NextRequest("http://localhost/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }));
beforeEach(() => { m.send.mockResolvedValue(true); m.create.mockResolvedValue({}); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("POST /api/auth/send-otp", () => {
  it("never issues the fixed 1234 code to the seeded test phones in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (let i = 0; i < 20; i++) await send("09000000000");
    const codes = m.create.mock.calls.map(([arg]) => arg.data.code);
    expect(codes.length).toBe(20);
    expect(codes.every((code: string) => /^\d{4}$/.test(code))).toBe(true);
    expect(codes.filter((code: string) => code === "1234").length).toBeLessThan(3);
  });
});
