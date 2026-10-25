import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { sendOtp, verifyOtp } = vi.hoisted(() => ({ sendOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/app/api/auth/send-otp/route", () => ({ POST: sendOtp }));
vi.mock("@/app/api/auth/verify-otp/route", () => ({ POST: verifyOtp }));
vi.mock("@/lib/auth/jwt", () => ({ verifyToken: (t: string) => (t === "access" ? { userId: "u1" } : null) }));
vi.mock("@/lib/auth/mobileSessions", () => ({ createMobileSession: async () => ({ accessToken: "native-access", refreshToken: "native-refresh", expiresIn: 900, refreshExpiresAt: "2026-11-24T00:00:00.000Z", sessionId: "sid" }) }));
import { POST as requestCode } from "./route";
import { POST as verifyCode } from "./verify/route";
import { normalizeIranMobile, normalizeOtpCode } from "@/lib/mobile/otpPhone";

const req = (path: string, body: unknown) => new NextRequest(`https://example.test${path}`, { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("MOBILE_API_ENABLED", "true"); });

describe("phone and code normalisation", () => {
  it.each([["09123456789", "09123456789"], ["۰۹۱۲ ۳۴۵ ۶۷۸۹", "09123456789"], ["+98 912 345 6789", "09123456789"], ["00989123456789", "09123456789"], ["9123456789", "09123456789"], ["٠٩١٢٣٤٥٦٧٨٩", "09123456789"]])("%s -> %s", (raw, out) => {
    expect(normalizeIranMobile(raw)).toBe(out);
  });
  it.each(["", "0812345678", "091234567890", "abc", "0912-345-678x", 912345678])("rejects %s", raw => expect(normalizeIranMobile(raw)).toBeNull());
  it("normalises codes", () => {
    expect(normalizeOtpCode("۴۸۱۷")).toBe("4817");
    expect(normalizeOtpCode("12a4")).toBeNull();
    expect(normalizeOtpCode("12")).toBeNull();
  });
});

describe("POST /api/mobile/v1/session/otp", () => {
  it("is disabled unless mobile access is enabled", async () => {
    vi.stubEnv("MOBILE_API_ENABLED", "");
    expect((await requestCode(req("/api/mobile/v1/session/otp", { phone: "09123456789" }))).status).toBe(503);
    expect(sendOtp).not.toHaveBeenCalled();
  });
  it("rejects invalid phones without calling the SMS sender", async () => {
    expect((await requestCode(req("/api/mobile/v1/session/otp", { phone: "123" }))).status).toBe(400);
    expect(sendOtp).not.toHaveBeenCalled();
  });
  it("forwards the normalised phone to the web sender", async () => {
    sendOtp.mockResolvedValue(NextResponse.json({ success: true }));
    const res = await requestCode(req("/api/mobile/v1/session/otp", { phone: "۰۹۱۲۳۴۵۶۷۸۹" }));
    expect(res.status).toBe(200);
    expect(await (sendOtp.mock.calls[0][0] as NextRequest).json()).toEqual({ phone: "09123456789" });
    expect(await res.json()).toEqual({ success: true, phone: "09123456789", resendAfterSec: 60 });
  });
  it("preserves rate limits", async () => {
    sendOtp.mockResolvedValue(NextResponse.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "120" } }));
    const res = await requestCode(req("/api/mobile/v1/session/otp", { phone: "09123456789" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
  });
});

describe("POST /api/mobile/v1/session/otp/verify", () => {
  const ok = (name: string | null) => { const r = NextResponse.json({ success: true, user: { id: "u1", name } }); r.cookies.set("token", "access"); r.cookies.set("refresh_token", "web-refresh"); return r; };
  it("returns a native session and no browser cookies", async () => {
    verifyOtp.mockResolvedValue(ok("Sara"));
    const res = await verifyCode(req("/api/mobile/v1/session/otp/verify", { phone: "09123456789", code: "۱۲۳۴" }));
    expect(res.status).toBe(200);
    expect(await (verifyOtp.mock.calls[0][0] as NextRequest).json()).toEqual({ phone: "09123456789", code: "1234" });
    const body = await res.json();
    expect(body).toMatchObject({ accessToken: "native-access", refreshToken: "native-refresh", needsProfile: false });
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("asks for a profile when the account has no name", async () => {
    verifyOtp.mockResolvedValue(ok(null));
    expect((await (await verifyCode(req("/api/mobile/v1/session/otp/verify", { phone: "09123456789", code: "1234" }))).json()).needsProfile).toBe(true);
  });
  it.each([400, 429])("preserves verifier denial %s", async status => {
    verifyOtp.mockResolvedValue(NextResponse.json({ error: "wrong" }, { status }));
    const res = await verifyCode(req("/api/mobile/v1/session/otp/verify", { phone: "09123456789", code: "1111" }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: "wrong" });
  });
  it("rejects malformed input before verification", async () => {
    expect((await verifyCode(req("/api/mobile/v1/session/otp/verify", { phone: "09123456789", code: "x" }))).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it("fails closed when the verifier issues no token", async () => {
    verifyOtp.mockResolvedValue(NextResponse.json({ success: true }));
    expect((await verifyCode(req("/api/mobile/v1/session/otp/verify", { phone: "09123456789", code: "1234" }))).status).toBe(500);
  });
});
