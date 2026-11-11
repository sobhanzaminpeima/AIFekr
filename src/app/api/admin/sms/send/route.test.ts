import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ admin: vi.fn(), users: vi.fn(), create: vi.fn(), update: vi.fn(), audit: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAdmin: m.admin, unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findMany: m.users }, smsBroadcast: { create: m.create, update: m.update }, auditLog: { create: m.audit } } }));
vi.mock("@/lib/sms/send", () => ({ sendTextSms: m.send }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/admin/sms/send", { method: "POST", body: JSON.stringify(body) }));
const segment = { type: "segment", segment: { paid: "unpaid" } };

beforeEach(() => {
  vi.clearAllMocks();
  m.admin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  m.users.mockResolvedValue([{ phone: "09121111111" }, { phone: "09122222222" }, { phone: "09122222222" }, { phone: "bad" }]);
  m.create.mockResolvedValue({ id: "b1" });
  m.send.mockResolvedValue({ sent: 2, failed: 0, cost: 2, errors: [] });
});

describe("admin SMS send", () => {
  it("refuses anyone who is not an admin", async () => {
    m.admin.mockResolvedValue(null);
    expect((await post({ audience: segment, text: "سلام", preview: true })).status).toBe(401);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("previews distinct valid numbers, masked, and sends nothing", async () => {
    const body = await (await post({ audience: segment, text: "سلام", preview: true })).json();
    expect(body.recipients).toBe(2);
    expect(body.sample).toEqual(["0912***1111", "0912***2222"]);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuses a send whose count no longer matches the preview", async () => {
    const res = await post({ audience: segment, text: "سلام", confirmCount: 5 });
    expect(res.status).toBe(409);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends the confirmed audience once, records counts and audits, without storing numbers", async () => {
    const res = await post({ audience: segment, text: "سلام", confirmCount: 2 });
    expect(res.status).toBe(200);
    expect(m.send).toHaveBeenCalledWith(["09121111111", "09122222222"], "سلام");
    expect(JSON.stringify(m.create.mock.calls[0][0])).not.toContain("0912");
    expect(m.update.mock.calls[0][0].data).toMatchObject({ sent: 2, failed: 0, status: "done" });
    expect(m.audit).toHaveBeenCalledTimes(1);
  });

  it("only ever targets customers, never admins, blocked or opted-out users", async () => {
    await post({ audience: segment, text: "سلام", preview: true });
    const where = JSON.stringify(m.users.mock.calls[0][0].where);
    expect(where).toContain('"role":"USER"');
    expect(where).toContain('"followupSuppressions":{"none":{}}');
  });
});
