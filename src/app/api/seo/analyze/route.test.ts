import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ create: vi.fn(), model: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { seoGeneration: { create: m.create } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1", role: "USER" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/toolCredits", () => ({ reserveToolCredits: async () => ({ ok: true, credits: 2, release: async () => {} }) }));
vi.mock("@/lib/utils/creditCosts", () => ({ getCreditCosts: async () => ({ tool: 2 }) }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => "fa" }));
vi.mock("@/lib/net/safeUrl", () => ({ safeFetch: vi.fn() }));
vi.mock("@/lib/ai/router", () => ({ routedStreamChat: m.model }));
import { POST } from "./route";

const run = () => POST(new NextRequest("http://localhost/api/seo/analyze", { method: "POST", body: JSON.stringify({ tool: "content", keyword: "قهوه", content: "متن" }) }));
const answers = (...chunks: string[]) => async (_m: unknown, _s: unknown, onChunk: (c: string) => void) => { chunks.forEach(onChunk); };

beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({ id: "g1" }); });

describe("POST /api/seo/analyze history", () => {
  it("saves the whole answer for the user before reporting completion", async () => {
    m.model.mockImplementation(answers("بخش اول ", "بخش دوم"));
    const body = await (await run()).text();
    expect(body).toContain("[DONE]");
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", tool: "content", keyword: "قهوه", output: "بخش اول بخش دوم", credits: 2, status: "complete" });
  });

  it("still saves when the reader leaves midway", async () => {
    let finish = () => {};
    const halted = new Promise<void>((resolve) => { finish = resolve; });
    m.model.mockImplementation(async (_m: unknown, _s: unknown, onChunk: (c: string) => void) => { onChunk("اول "); await halted; onChunk("آخر"); });
    const res = await run();
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    finish();
    await vi.waitFor(() => expect(m.create).toHaveBeenCalledTimes(1));
    expect(m.create.mock.calls[0][0].data).toMatchObject({ output: "اول آخر", status: "complete" });
  });

  it("keeps what arrived as partial when the model fails midway", async () => {
    m.model.mockImplementation(async (_m: unknown, _s: unknown, onChunk: (c: string) => void) => { onChunk("نیمه"); throw new Error("provider"); });
    const body = await (await run()).text();
    expect(body).toContain('"error"');
    expect(m.create.mock.calls[0][0].data).toMatchObject({ output: "نیمه", status: "partial" });
  });

  it("saves nothing for an empty answer", async () => {
    m.model.mockImplementation(answers());
    await (await run()).text();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("still answers when the save fails", async () => {
    m.model.mockImplementation(answers("متن"));
    m.create.mockRejectedValue(new Error("disk"));
    expect(await (await run()).text()).toContain("[DONE]");
  });
});
