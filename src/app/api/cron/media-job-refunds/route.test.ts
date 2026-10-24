import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/auth/cronAuth", () => ({ isCronAuthorized: () => true }));
import { GET } from "./route";

const userId = `media-refund-${Date.now()}`;
const old = new Date(Date.now() - 7 * 60 * 60 * 1000);

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId, credits: 0 } });
  await prisma.generatedVideo.createMany({ data: [
    { userId, prompt: "stuck", url: "prediction-123", credits: 20, createdAt: old },
    { userId, prompt: "done", url: "https://cdn.example/v.mp4", credits: 20, createdAt: old },
    { userId, prompt: "fresh", url: "prediction-456", credits: 20 },
  ] });
  await prisma.generatedMusic.create({ data: { userId, prompt: "stuck", url: "prediction-789", credits: 10, createdAt: old } });
});
afterAll(async () => {
  await prisma.generatedVideo.deleteMany({ where: { userId } });
  await prisma.generatedMusic.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("GET /api/cron/media-job-refunds", () => {
  it("refunds only stale unfinished jobs, and only once", async () => {
    const call = () => GET(new NextRequest("http://localhost/api/cron/media-job-refunds"));
    await call();
    await call();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(30);
    expect(await prisma.generatedVideo.count({ where: { userId, refunded: true } })).toBe(1);
    expect(await prisma.generatedMusic.count({ where: { userId, refunded: true } })).toBe(1);
  });
});
