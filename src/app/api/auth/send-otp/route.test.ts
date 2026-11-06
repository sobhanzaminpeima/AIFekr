import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), user: vi.fn(), setting: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { otpCode: { create: m.create, count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() }, user: { findUnique: m.user }, siteSetting: { findUnique: m.setting } } }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => "fa" }));
vi.mock("@/lib/sms/smsir", () => ({ sendOTP: m.send }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true, retryAfterSec: 0 }), getClientIp: () => "1.2.3.4" }));
import { POST } from "./route";

const send = (phone: string) => POST(new NextRequest("http://localhost/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }));
beforeEach(() => { m.send.mockResolvedValue(true); m.create.mockResolvedValue({}); m.user.mockResolvedValue({ id: "existing" }); m.setting.mockResolvedValue(null); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("POST /api/auth/send-otp", () => {
  it("refuses the seeded test phones in production and never echoes a code", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await send("09000000000");
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/dev_code|\d{4}/);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends a random code by SMS to real phones in production without returning it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const codes: string[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await send("09123456789");
      expect(await res.json()).toEqual({ success: true });
    }
    for (const [arg] of m.create.mock.calls) codes.push(arg.data.code);
    expect(codes.every(code => /^\d{4}$/.test(code))).toBe(true);
    expect(codes.filter(code => code === "1234").length).toBeLessThan(3);
    expect(m.send).toHaveBeenCalledTimes(20);
  });

  it("while sign-up by number is off, sends nothing to a number without an account and points to email", async () => {
    vi.stubEnv("NODE_ENV", "production");
    m.user.mockResolvedValue(null);
    const res = await send("09123456780");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("PHONE_SIGNUP_OFF");
    expect(body.error).toContain("ایمیل");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("when sign-up by number is switched on, a new number gets a code again", async () => {
    vi.stubEnv("NODE_ENV", "production");
    m.user.mockResolvedValue(null);
    m.setting.mockResolvedValue({ value: JSON.stringify({ enabled: true }) });
    expect(await (await send("09123456781")).json()).toEqual({ success: true });
    expect(m.send).toHaveBeenCalledTimes(1);
  });
});
