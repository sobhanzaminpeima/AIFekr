import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/toolCredits", () => ({ reserveToolCredits: m.reserve }));
import { withToolCredits } from "./withToolCredits";

const req = (key?: string) => new NextRequest("http://localhost/api/x", { method: "POST", headers: key ? { "Idempotency-Key": key } : {} });
let n = 0;
const fresh = () => `key-${Date.now()}-${n++}`;

beforeEach(() => {
  vi.clearAllMocks();
  m.reserve.mockResolvedValue({ ok: true, credits: 2, release: m.release });
});

describe("paid tools charge once per request key", () => {
  it("refuses a forced double submit with the same key and charges once", async () => {
    let finish = () => {};
    const slow = withToolCredits("seo.analyze", () => new Promise<Response>((resolve) => { finish = () => resolve(new Response("ok")); }));
    const key = fresh();
    const first = slow(req(key));
    await vi.waitFor(() => expect(m.reserve).toHaveBeenCalledTimes(1));
    const second = await slow(req(key));
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("DUPLICATE_REQUEST");
    finish();
    expect((await first).status).toBe(200);
    expect(m.reserve).toHaveBeenCalledTimes(1);
    expect(m.reserve.mock.calls[0][2]).toEqual({ requestId: `idem:seo.analyze:${key}` });
  });

  it("lets a retry run after the first attempt failed and was refunded", async () => {
    const failing = withToolCredits("seo.analyze", async () => new Response("no", { status: 502 }));
    const key = fresh();
    expect((await failing(req(key))).status).toBe(502);
    expect(m.release).toHaveBeenCalledTimes(1);
    const ok = withToolCredits("seo.analyze", async () => new Response("ok"));
    expect((await ok(req(key))).status).toBe(200);
  });

  it("keeps working for clients that send no key", async () => {
    const ok = withToolCredits("seo.analyze", async () => new Response("ok"));
    expect((await ok(req())).status).toBe(200);
    expect((await ok(req())).status).toBe(200);
    expect(m.reserve).toHaveBeenCalledTimes(2);
  });
});
