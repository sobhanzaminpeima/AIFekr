import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/app/api/auth/login/route", () => ({ POST: login }));
vi.mock("@/lib/auth/jwt", () => ({ verifyToken: () => ({ userId: "test-user" }) }));
vi.mock("@/lib/auth/mobileSessions", () => ({ createMobileSession: async () => ({ accessToken: "native-access", refreshToken: "native-refresh", expiresIn: 900, sessionId: "native-id" }), revokeByRefresh: vi.fn() }));
import { POST } from "./route";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("MOBILE_API_ENABLED", "true"); });
const request = () => new NextRequest("https://example.test/api/mobile/v1/session", { method: "POST" });
describe("native session bridge", () => {
  it("is disabled by default and does not attempt credential verification", async () => {
    vi.stubEnv("MOBILE_API_ENABLED", "");
    expect((await POST(request())).status).toBe(503);
    expect(login).not.toHaveBeenCalled();
  });
  it("returns only the access token, never refresh cookies or account secrets", async () => {
    const result = NextResponse.json({ user: { email: "private@example.test" } });
    result.cookies.set("token", "access"); result.cookies.set("refresh_token", "refresh-secret");
    login.mockResolvedValue(result);
    const response = await POST(request());
    expect(await response.json()).toEqual({ accessToken: "native-access", refreshToken: "native-refresh", expiresIn: 900, sessionId: "native-id" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([400, 401, 403, 429, 500])("preserves login denial %s", async status => {
    login.mockResolvedValue(NextResponse.json({ error: "Denied" }, { status, headers: { "Retry-After": "90" } }));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Denied" });
    expect(response.headers.get("Retry-After")).toBe("90");
  });
  it("fails closed if successful login did not issue a token", async () => {
    login.mockResolvedValue(NextResponse.json({ success: true }));
    expect((await POST(request())).status).toBe(500);
  });
});
