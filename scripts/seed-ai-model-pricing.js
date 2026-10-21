// Seeds AiModelPricing with launch-day $ estimates so the cost ledger has
// real numbers from day one instead of every UsageLog row showing a null
// estimatedCostUsd. Prices are per-provider public list prices as of
// 2026-09-17; admins can edit them from the admin panel once that UI exists
// -- this script is safe to re-run (upsert), so a re-run after a price
// change just refreshes these defaults for rows that haven't been
// hand-edited... but since there's no "hand-edited" flag yet, re-running
// will overwrite any admin edits. Intended as a one-time seed.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Chat: $ per 1M tokens. Media: $ per unit (image = per image, video/music = per second).
const PRICING = [
  { providerId: "claude", kind: "chat", inputPricePerMillion: 1.0, outputPricePerMillion: 5.0 },
  { providerId: "gpt5", kind: "chat", inputPricePerMillion: 1.25, outputPricePerMillion: 10.0 },
  { providerId: "openai-direct", kind: "chat", inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
  { providerId: "deepseek-v3", kind: "chat", inputPricePerMillion: 0.27, outputPricePerMillion: 1.1 },
  { providerId: "deepseek-direct", kind: "chat", inputPricePerMillion: 0.27, outputPricePerMillion: 1.1 },
  { providerId: "openrouter", kind: "chat", inputPricePerMillion: 1.25, outputPricePerMillion: 10.0 },
  { providerId: "gemini", kind: "chat", inputPricePerMillion: 0.075, outputPricePerMillion: 0.3 },
  { providerId: "groq", kind: "chat", inputPricePerMillion: 0, outputPricePerMillion: 0 },
  { providerId: "cohere", kind: "chat", inputPricePerMillion: 0, outputPricePerMillion: 0 },
  { providerId: "openai-image", kind: "image", pricePerUnit: 0.04 },
  { providerId: "qwen-image", kind: "image", pricePerUnit: 0.02 },
  { providerId: "qwen", kind: "video", pricePerUnit: 0.1 },
  { providerId: "qwen-video-i2v", kind: "video", pricePerUnit: 0.1 },
  { providerId: "replicate", kind: "video", pricePerUnit: 0.15 },
  { providerId: "elevenlabs", kind: "music", pricePerUnit: 0.02 },
  { providerId: "replicate", kind: "music", pricePerUnit: 0.01 },
];

(async () => {
  for (const p of PRICING) {
    await prisma.aiModelPricing.upsert({
      where: { providerId_kind: { providerId: p.providerId, kind: p.kind } },
      update: p,
      create: p,
    });
    console.log(`seeded ${p.providerId}/${p.kind}`);
  }
  await prisma.$disconnect();
})();
