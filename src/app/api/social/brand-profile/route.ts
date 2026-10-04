export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getBrandProfile } from "@/lib/social/brandProfile";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json({ profile: await getBrandProfile(user.id) });
}

const clamp = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });

  const pillars = Array.isArray(body.contentPillars)
    ? body.contentPillars.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 5).map((x: string) => x.trim().slice(0, 80))
    : [];

  const data = {
    pageType: clamp(body.pageType, 120),
    specialty: clamp(body.specialty, 400),
    audience: clamp(body.audience, 400),
    tone: clamp(body.tone, 200),
    contentPillars: pillars.length ? JSON.stringify(pillars) : null,
    avoidTopics: clamp(body.avoidTopics, 600),
    positioning: clamp(body.positioning, 800),
  };

  await prisma.socialBrandProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  // Mirror the positioning into the shared business memory so the CEO
  // Orchestrator and the SEO pipeline inherit it instead of each module
  // holding its own private idea of who this business is.
  const memoryText = [
    data.pageType && `نوع پیج اینستاگرام: ${data.pageType}`,
    data.audience && `مخاطب هدف: ${data.audience}`,
    data.tone && `لحن برند: ${data.tone}`,
    data.positioning && `موضع رقابتی: ${data.positioning}`,
  ].filter(Boolean).join(" — ");

  if (memoryText) {
    try {
      const existing = await prisma.businessMemory.findFirst({
        where: { userId: user.id, category: "social", source: "user" },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        await prisma.businessMemory.update({ where: { id: existing.id }, data: { text: memoryText } });
      } else {
        await prisma.businessMemory.create({ data: { userId: user.id, category: "social", source: "user", text: memoryText } });
      }
    } catch (e) {
      // Never fail the save over the memory mirror.
      console.error("brand-profile: business memory mirror failed", e);
    }
  }

  return NextResponse.json({ ok: true });
}
