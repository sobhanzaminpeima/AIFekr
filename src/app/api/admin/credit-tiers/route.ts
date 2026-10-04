export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }
  const tiers = await prisma.creditPricingTier.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ tiers });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  const { creditsAmount, priceToman, discountPercent, badge, sortOrder } = await req.json();
  if (!creditsAmount || !priceToman) {
    return NextResponse.json({ error: "تعداد اعتبار و قیمت الزامی است" }, { status: 400 });
  }

  const tier = await prisma.creditPricingTier.create({
    data: {
      creditsAmount: Math.round(creditsAmount),
      priceToman: Math.round(priceToman),
      discountPercent: Math.round(discountPercent || 0),
      badge: badge || null,
      sortOrder: sortOrder ?? 0,
    },
  });
  return NextResponse.json({ tier });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of ["creditsAmount", "priceToman", "discountPercent", "badge", "sortOrder", "isActive"]) {
    if (key in rest) data[key] = rest[key];
  }

  const tier = await prisma.creditPricingTier.update({ where: { id }, data });
  return NextResponse.json({ tier });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });

  await prisma.creditPricingTier.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
