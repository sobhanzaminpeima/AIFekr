import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const state = vi.hoisted(() => ({ user: null as null | {
        id: string;
        role: string;
    } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => state.user, unauthorizedResponse: () => NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }) }));
import { GET, POST } from "./route";
import { GET as adminGET, POST as adminPOST } from "../admin/voice-studio/route";
afterEach(() => { state.user = null; });
describe("Voice Studio HTTP access boundaries", () => {
    it("requires authentication for user reads and writes", async () => { expect((await GET(new NextRequest("http://localhost/api/voice-studio"))).status).toBe(401); expect((await POST(new NextRequest("http://localhost/api/voice-studio", { method: "POST" }))).status).toBe(401); });
    it("denies admin data to a normal account", async () => { state.user = { id: "test", role: "USER" }; expect((await adminGET(new NextRequest("http://localhost/api/admin/voice-studio"))).status).toBe(401); });
    it("rejects cross-origin authenticated user writes before processing", async () => { state.user = { id: "test", role: "USER" }; expect((await POST(new NextRequest("http://localhost/api/voice-studio", { method: "POST", headers: { origin: "https://attacker.example" }, body: '{"action":"generate"}' }))).status).toBe(403); });
    it("rejects cross-origin admin writes", async () => { state.user = { id: "test", role: "SUPER_ADMIN" }; expect((await adminPOST(new NextRequest("http://localhost/api/admin/voice-studio", { method: "POST", headers: { origin: "https://attacker.example" }, body: '{}' }))).status).toBe(403); });
});
