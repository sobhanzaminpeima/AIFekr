export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { chatPolicy, policySchema } from "@/lib/ai-chat/policy";
import { discoveryModules } from "@/lib/ai-chat/discovery";
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  const since = new Date(Date.now() - 7 * 86400000),
    [
      policy,
      statuses,
      usage,
      guests,
      converted,
      chatOnly,
      discovery,
      providers,
    ] = await Promise.all([
      chatPolicy(),
      prisma.aiChatRequest.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.aiChatRequest.aggregate({
        where: { createdAt: { gte: since }, status: "SUCCEEDED" },
        _sum: { credits: true, costUsd: true },
        _count: { _all: true },
      }),
      prisma.aiChatGuest.count({ where: { createdAt: { gte: since } } }),
      prisma.aiChatGuest.count({
        where: { createdAt: { gte: since }, mergedUserId: { not: null } },
      }),
      prisma.user.count({ where: { chatOnly: true } }),
      prisma.aiChatDiscoveryEvent.groupBy({
        by: ["action"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.customAiProvider.findMany({
        where: { type: "chat", id: {in:["cloudflare-llama-70b","openai-gpt-5-mini"]} },
        select: { id: true, name: true, model: true, enabled: true },
      }),
    ]);
  return NextResponse.json(
    {
      policy,
      metrics: { statuses, usage, guests, converted, chatOnly, discovery },
      modules: [...discoveryModules.map((m) => m.id), "fitness"],
      providers,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const policy = policySchema.parse(await req.json());
    if (!["cloudflare-llama-70b","openai-gpt-5-mini"].includes(policy.modelId))
      throw Error("MODEL_NOT_APPROVED");
    await prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: "independentAiChat" },
        create: { key: "independentAiChat", value: JSON.stringify(policy) },
        update: { value: JSON.stringify(policy) },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "ai-chat.policy.updated",
          metadata: JSON.stringify(policy),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "POLICY_NOT_SAVED" }, { status: 400 });
  }
}
