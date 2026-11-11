import { it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAdmin: m.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: m.find, update: m.update }, auditLog: { create: m.audit } } }));
import { POST } from "./route";

const request = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/admin/set-role", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); m.find.mockResolvedValue({ role: "USER" }); });

it("refuses a plain admin, including self-promotion to super admin", async () => {
  m.auth.mockResolvedValue({ id: "admin", role: "ADMIN" });
  expect((await POST(request({ userId: "admin", role: "SUPER_ADMIN" }))).status).toBe(403);
  expect((await POST(request({ userId: "other", role: "ADMIN" }))).status).toBe(403);
  expect(m.update).not.toHaveBeenCalled();
});

it("refuses a super admin changing their own role", async () => {
  m.auth.mockResolvedValue({ id: "boss", role: "SUPER_ADMIN" });
  expect((await POST(request({ userId: "boss", role: "USER" }))).status).toBe(403);
  expect(m.update).not.toHaveBeenCalled();
});

it("lets a super admin change another account's role and audits it", async () => {
  m.auth.mockResolvedValue({ id: "boss", role: "SUPER_ADMIN" });
  expect((await POST(request({ userId: "u1", role: "MODERATOR" }))).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "MODERATOR" } });
  expect(JSON.parse(m.audit.mock.calls[0][0].data.metadata).changes.role).toEqual({ from: "USER", to: "MODERATOR" });
});

it("rejects unknown roles and signed-out callers", async () => {
  m.auth.mockResolvedValue({ id: "boss", role: "SUPER_ADMIN" });
  expect((await POST(request({ userId: "u1", role: "OWNER" }))).status).toBe(400);
  m.auth.mockResolvedValue(null);
  expect((await POST(request({ userId: "u1", role: "ADMIN" }))).status).toBe(401);
  expect(m.update).not.toHaveBeenCalled();
});
