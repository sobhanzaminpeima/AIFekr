import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/video-factory/http", async () => ({
  factoryRoute: async (_req: NextRequest, _admin: boolean, fn: (actor: string) => Promise<Response>) => { try { return await fn("admin"); } catch { return new Response(JSON.stringify({ error: "INVALID" }), { status: 400 }); } },
  boundedJson: (req: NextRequest) => req.json(),
}));
vi.mock("@/lib/video-factory/packagePricing", () => ({ repriceVideoDrafts: vi.fn(async () => []) }));
vi.mock("@/lib/video-factory/config", () => ({ getPolicy: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { POST } from "./route";
import { repriceVideoDrafts } from "@/lib/video-factory/packagePricing";
import { detailedCommercialSchema } from "@/lib/video-factory/economics";
import { defaultRateCard } from "@/lib/video-factory/costing";

const post = (body: unknown) => POST(new NextRequest("http://x/api/admin/video-factory/economics", { method: "POST", body: JSON.stringify(body) }));

describe("video factory economics ESTIMATE", () => {
  it("computes the 8-minute example and per-minute cost without saving or repricing", async () => {
    const commercial = detailedCommercialSchema.parse({ rateCard: defaultRateCard });
    const res = await post({ action: "ESTIMATE", commercial });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.example.seconds).toBe(480);
    expect(d.perMinute.costCents).toBeGreaterThan(0);
    expect(d.defaultRateCard.rates.length).toBeGreaterThan(0);
    expect(repriceVideoDrafts).not.toHaveBeenCalled();
  });
  it("rejects unknown actions", async () => {
    expect((await post({ action: "SAVE" })).status).toBe(400);
  });
});
