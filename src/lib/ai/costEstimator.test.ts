import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { estimateCostUsd } from "./costEstimator";

describe("estimateCostUsd", () => {
  beforeAll(async () => {
    await prisma.aiModelPricing.upsert({
      where: { providerId_kind: { providerId: "test-chat-provider", kind: "chat" } },
      update: { inputPricePerMillion: 2, outputPricePerMillion: 8, isActive: true },
      create: { providerId: "test-chat-provider", kind: "chat", inputPricePerMillion: 2, outputPricePerMillion: 8 },
    });
    await prisma.aiModelPricing.upsert({
      where: { providerId_kind: { providerId: "test-video-provider", kind: "video" } },
      update: { pricePerUnit: 0.1, isActive: true },
      create: { providerId: "test-video-provider", kind: "video", pricePerUnit: 0.1 },
    });
    await prisma.aiModelPricing.upsert({
      where: { providerId_kind: { providerId: "test-inactive-provider", kind: "chat" } },
      update: { inputPricePerMillion: 2, outputPricePerMillion: 8, isActive: false },
      create: { providerId: "test-inactive-provider", kind: "chat", inputPricePerMillion: 2, outputPricePerMillion: 8, isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.aiModelPricing.deleteMany({
      where: { providerId: { in: ["test-chat-provider", "test-video-provider", "test-inactive-provider"] } },
    });
  });

  it("computes chat cost from input/output token rates", async () => {
    const cost = await estimateCostUsd({
      kind: "chat",
      providerId: "test-chat-provider",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });
    expect(cost).toBeCloseTo(2 + 4, 6);
  });

  it("bills cached tokens at the input rate", async () => {
    const cost = await estimateCostUsd({
      kind: "chat",
      providerId: "test-chat-provider",
      inputTokens: 500_000,
      outputTokens: 0,
      cachedTokens: 500_000,
    });
    expect(cost).toBeCloseTo(2, 6);
  });

  it("computes media cost from per-unit rate", async () => {
    const cost = await estimateCostUsd({ kind: "video", providerId: "test-video-provider", units: 10 });
    expect(cost).toBeCloseTo(1, 6);
  });

  it("returns null when no pricing row exists", async () => {
    const cost = await estimateCostUsd({ kind: "chat", providerId: "nonexistent-provider", inputTokens: 100, outputTokens: 100 });
    expect(cost).toBeNull();
  });

  it("returns null when the pricing row is inactive", async () => {
    const cost = await estimateCostUsd({ kind: "chat", providerId: "test-inactive-provider", inputTokens: 100, outputTokens: 100 });
    expect(cost).toBeNull();
  });
});
