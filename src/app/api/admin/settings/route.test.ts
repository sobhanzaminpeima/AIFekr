import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => auth.user }));
import { POST } from "./route";

const stamp = `settings-test-${Date.now()}`;
const post = (settings: Record<string, string>) => POST(new NextRequest("http://localhost/api/admin/settings", { method: "POST", body: JSON.stringify({ settings }) }));

beforeEach(async () => {
  await prisma.siteSetting.upsert({ where: { key: "zarinpal_merchant" }, update: { value: "merchant-original" }, create: { key: "zarinpal_merchant", value: "merchant-original" } });
});
afterAll(async () => {
  await prisma.siteSetting.deleteMany({ where: { key: { in: ["zarinpal_merchant", `${stamp}_flag`] } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { startsWith: stamp } } });
});

describe("POST /api/admin/settings", () => {
  it("refuses a plain ADMIN changing the payment merchant", async () => {
    auth.user = { id: `${stamp}-admin`, role: "ADMIN" };
    expect((await post({ zarinpal_merchant: "attacker" })).status).toBe(403);
    expect((await prisma.siteSetting.findUnique({ where: { key: "zarinpal_merchant" } }))?.value).toBe("merchant-original");
  });
  it("lets a plain ADMIN save a whole form when payment values are unchanged", async () => {
    auth.user = { id: `${stamp}-admin`, role: "ADMIN" };
    expect((await post({ zarinpal_merchant: "merchant-original", [`${stamp}_flag`]: "on" })).status).toBe(200);
    expect((await prisma.siteSetting.findUnique({ where: { key: `${stamp}_flag` } }))?.value).toBe("on");
  });
  it("lets a SUPER_ADMIN change it and records old and new values", async () => {
    auth.user = { id: `${stamp}-super`, role: "SUPER_ADMIN" };
    expect((await post({ zarinpal_merchant: "merchant-new" })).status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: `${stamp}-super`, action: "site_settings_updated" } });
    expect(JSON.parse(audit.metadata || "{}").payment).toEqual([{ key: "zarinpal_merchant", from: "merchant-original", to: "merchant-new" }]);
  });
  it("rejects malformed keys", async () => {
    auth.user = { id: `${stamp}-super`, role: "SUPER_ADMIN" };
    expect((await post({ "bad key;": "x" })).status).toBe(400);
  });
});
