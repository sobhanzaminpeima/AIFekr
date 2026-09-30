export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const pack = await prisma.industryPack.findUnique({
      where: { slug: params.slug },
    });

    if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

    return NextResponse.json({
      pack: {
        ...pack,
        targetCustomers: JSON.parse(pack.targetCustomers),
        painPoints: JSON.parse(pack.painPoints),
        agents: JSON.parse(pack.agents),
        outcomes: JSON.parse(pack.outcomes),
        kpis: JSON.parse(pack.kpis),
      },
    });
  } catch (err) {
    console.error("Pack GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { crmPlan: true, crmPlanExpiry: true } });
    const crmActive = !!account && account.crmPlan !== "NONE" && (!account.crmPlanExpiry || account.crmPlanExpiry.getTime() > Date.now());
    if (!crmActive) return NextResponse.json({ error: "برای فعال‌کردن بسته‌های صنعتی ابتدا اشتراک کسب‌وکار/CRM را تهیه کنید" }, { status: 402 });
    const pack = await prisma.industryPack.findFirst({ where: { slug: params.slug, isActive: true } });
    if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

    await prisma.user.update({
      where: { id: user.id },
      data: { industryPackId: pack.id },
    });

    return NextResponse.json({ success: true, packId: pack.id });
  } catch (err) {
    console.error("Pack activate error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
