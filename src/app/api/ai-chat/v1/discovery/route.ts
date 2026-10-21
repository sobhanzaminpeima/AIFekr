export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatIdentity } from "@/lib/ai-chat/identity";
import { recommend } from "@/lib/ai-chat/discovery";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const i = await chatIdentity(req);
    if (!i)
      return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
    if (!rateLimit(`chat-discovery:${i.key}`, 30, 60000).allowed)
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    const b = z
      .object({
        action: z.enum(["recommend", "shown", "click", "dismiss", "disable"]),
        requestId: z.uuid().optional(),
        moduleId: z.string().max(80).optional(),
        language: z.enum(["fa", "en", "de", "tr"]).default("en"),
      })
      .strict()
      .parse(await req.json());
    if (b.action === "disable") {
      await prisma.aiChatDiscoveryPreference.upsert({
        where: { ownerKey: i.key },
        create: { ownerKey: i.key, disabled: true },
        update: { disabled: true },
      });
      return NextResponse.json({ ok: true });
    }
    if (!b.requestId) throw Error("REQUEST_REQUIRED");
    if (b.action === "recommend")
      return NextResponse.json({
        card: await recommend(i.key, b.requestId, b.language),
      });
    if (
      !b.moduleId ||
      !(await prisma.aiChatDiscoveryEvent.findFirst({
        where: { id: `${b.requestId}:${b.moduleId}:eligible`, ownerKey: i.key },
      }))
    )
      throw Error("RECOMMENDATION_NOT_ISSUED");
    await prisma.$transaction(async (tx) => {
      if (b.action === "dismiss") {
        const p = await tx.aiChatDiscoveryPreference.upsert({
            where: { ownerKey: i.key },
            create: { ownerKey: i.key },
            update: {},
          }),
          dismissed = Array.from(
            new Set([...(JSON.parse(p.dismissed) as string[]), b.moduleId!]),
          );
        await tx.aiChatDiscoveryPreference.update({
          where: { ownerKey: i.key },
          data: { dismissed: JSON.stringify(dismissed) },
        });
      }
      await tx.aiChatDiscoveryEvent.upsert({
        where: { id: `${b.requestId}:${b.moduleId}:${b.action}` },
        create: {
          id: `${b.requestId}:${b.moduleId}:${b.action}`,
          ownerKey: i.key,
          requestId: b.requestId!,
          moduleId: b.moduleId!,
          action: b.action,
        },
        update: {},
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ card: null });
  }
}
