import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ track: vi.fn(async () => true), user: vi.fn(), verify: vi.fn() }));
vi.mock("./events", () => ({ trackEvent: mocks.track }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("@/lib/auth/jwt", () => ({ verifyToken: mocks.verify }));

import { FIRST_SUCCESS_SINCE, classifyFailure, recordGenerationFailed, recordGenerationSucceeded, withGenerationTracking } from "./generation";

const names = () => mocks.track.mock.calls.map((c) => (c as unknown as [{ name: string }])[0].name);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { mocks.track.mockClear(); mocks.user.mockReset(); mocks.verify.mockReset(); });

describe("classifyFailure", () => {
  it("tells credits, plan and limits apart", () => {
    expect(classifyFailure(402, { error: "اعتبار کافی ندارید" })).toBe("credits");
    expect(classifyFailure(402, { error: "تولید ویدیو برای پلن شما در دسترس نیست" })).toBe("plan");
    expect(classifyFailure(402, { error: "سقف ۵ تصویر ماهانهٔ پلن شما تمام شد" })).toBe("limit");
    expect(classifyFailure(403, { error: "x", requiresUpgrade: true })).toBe("plan");
    expect(classifyFailure(409, { code: "PLAN_REQUIRED" })).toBe("plan");
    expect(classifyFailure(429, null)).toBe("rate_limited");
    expect(classifyFailure(500, { error: "خطا" })).toBe("provider");
  });
  it("ignores success and signed-out calls", () => {
    expect(classifyFailure(200, null)).toBeNull();
    expect(classifyFailure(401, null)).toBeNull();
  });
});

describe("first success", () => {
  it("is recorded once per new account, with an idempotency key", async () => {
    mocks.user.mockResolvedValue({ createdAt: new Date(FIRST_SUCCESS_SINCE.getTime() + 60000) });
    await recordGenerationSucceeded("u1", "image", "img1");
    const calls = mocks.track.mock.calls.map((c) => (c as unknown as [{ name: string; idempotencyKey?: string }])[0]);
    expect(calls.map((c) => c.name)).toEqual(["generation_succeeded", "first_success_achieved"]);
    expect(calls[1].idempotencyKey).toBe("first_success:u1");
  });
  it("is not claimed for accounts that existed before measurement", async () => {
    mocks.user.mockResolvedValue({ createdAt: new Date("2026-01-01") });
    await recordGenerationSucceeded("u2", "chat", "m1");
    expect(names()).toEqual(["generation_succeeded"]);
  });
});

it("records credit and plan refusals under their own names", async () => {
  await recordGenerationFailed("u1", "video", "plan");
  await recordGenerationFailed("u1", "chat", "credits");
  expect(names()).toEqual(["generation_failed", "plan_required", "generation_failed", "credits_insufficient"]);
});

describe("withGenerationTracking", () => {
  const req = () => new NextRequest("http://localhost/api/x", { method: "POST", headers: { cookie: "token=t" } });
  it("returns the route's own response and measures it", async () => {
    mocks.verify.mockReturnValue({ userId: "u1" });
    mocks.user.mockResolvedValue({ createdAt: new Date("2026-01-01") });
    const route = withGenerationTracking("image", async () => Response.json({ images: [{ id: "i1" }] }), (b) => (b.images as { id: string }[])[0].id);
    const res = await route(req());
    expect(await res.json()).toEqual({ images: [{ id: "i1" }] });
    await flush();
    expect(names()).toEqual(["generation_started", "generation_succeeded"]);
  });
  it("records a classified failure", async () => {
    mocks.verify.mockReturnValue({ userId: "u1" });
    const route = withGenerationTracking("video", async () => Response.json({ error: "تولید ویدیو برای پلن شما در دسترس نیست" }, { status: 402 }), () => null);
    expect((await route(req())).status).toBe(402);
    await flush();
    expect(names()).toEqual(["generation_started", "generation_failed", "plan_required"]);
  });
  it("records nothing for a signed-out call", async () => {
    const route = withGenerationTracking("music", async () => Response.json({ error: "x" }, { status: 401 }), () => null);
    await route(new NextRequest("http://localhost/api/x", { method: "POST" }));
    await flush();
    expect(names()).toEqual([]);
  });
});
