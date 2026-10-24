import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ charge: vi.fn(), available: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "u1", plan: "PRO", credits: 1000 }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/utils/featureToggles", () => ({ isFeatureEnabled: async () => true, FEATURE_DISABLED_MESSAGE: { image: "off" } }));
vi.mock("@/lib/utils/teamCredits", () => ({ getAvailableCredits: m.available, chargeAndLog: m.charge }));
vi.mock("@/lib/ai/qwen", () => ({ isQwenImageAvailable: true, generateImages: m.generate, generateImageFromReference: m.generate }));
vi.mock("@/lib/ai/openaiImage", () => ({ isOpenAIImageAvailable: false }));
import { POST } from "./route";

const call = (body: Record<string, unknown>) => POST(new NextRequest("http://localhost/api/image/generate", { method: "POST", body: JSON.stringify({ prompt: "a cat", ...body }) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("POST /api/image/generate input guards", () => {
  it.each([0, -3, 5, 1.5, "2"])("rejects image count %s before any charge or generation", async (count) => {
    expect((await call({ count })).status).toBe(400);
    expect(m.generate).not.toHaveBeenCalled();
    expect(m.charge).not.toHaveBeenCalled();
  });
  it.each(["http://127.0.0.1:3000/api/admin", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd"])(
    "refuses reference image %s in production", async (url) => {
      vi.stubEnv("NODE_ENV", "production");
      expect((await call({ sourceImageUrls: [url] })).status).toBe(400);
      expect(m.generate).not.toHaveBeenCalled();
    });
});
