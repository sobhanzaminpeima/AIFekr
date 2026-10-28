import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { setMarketingConsent } from "@/lib/growth/signup";

/** The signed-in user's own communication preferences. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const p = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { marketingConsent: true, unsubscribedAt: true, consentAt: true } });
  return NextResponse.json({ marketingConsent: !!p?.marketingConsent, lifecycleMessages: !p?.unsubscribedAt, consentAt: p?.consentAt ?? null });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const body = z.object({ marketingConsent: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  await setMarketingConsent(user.id, body.data.marketingConsent, "settings");
  return NextResponse.json({ ok: true });
}
