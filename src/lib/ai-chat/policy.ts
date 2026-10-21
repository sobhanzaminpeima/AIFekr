import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
export const policySchema = z
  .object({
    enabled: z.boolean().default(false),
    guestTurns: z.number().int().min(0).max(10).default(3),
    guestTtlHours: z.number().int().min(1).max(168).default(168),
    registeredFreeDaily: z.number().int().min(0).max(100).default(10),
    creditsPerTurn: z.number().int().min(1).max(100).default(3),
    dailyRequests: z.number().int().min(1).max(10000).default(200),
    dailyBudgetUsd: z.number().min(0.05).max(1000).default(5),
    modelId: z.string().min(1).max(150).default("cloudflare-llama-70b"),
    discoveryEnabled: z.boolean().default(false),
    discoveryThreshold: z.number().min(0.5).max(1).default(0.8),
    discoveryFrequency: z.number().int().min(1).max(20).default(5),
    disabledModules: z.array(z.string().max(100)).max(30).default([]),
  })
  .strict();
export type ChatPolicy = z.infer<typeof policySchema>;
export async function chatPolicy() {
  const s = await prisma.siteSetting.findUnique({
    where: { key: "independentAiChat" },
  });
  return policySchema.parse(s ? JSON.parse(s.value) : {});
}
