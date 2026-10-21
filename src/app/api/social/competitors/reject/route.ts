export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * The owner-approval step required by the spec: when a competitor-derived
 * suggestion does not fit the brand, the owner says so and the reason is
 * appended to SocialBrandProfile.avoidTopics — so the next suggestion is
 * actually better instead of the model repeating the same miss.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "دلیل الزامی است" }, { status: 400 });

  const existing = await prisma.socialBrandProfile.findUnique({ where: { userId: user.id } });
  const merged = [existing?.avoidTopics, reason].filter(Boolean).join(" — ").slice(0, 600);

  await prisma.socialBrandProfile.upsert({
    where: { userId: user.id },
    update: { avoidTopics: merged },
    create: { userId: user.id, avoidTopics: merged },
  });

  return NextResponse.json({ ok: true, avoidTopics: merged });
}
