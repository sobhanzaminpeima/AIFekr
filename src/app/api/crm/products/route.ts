export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "1";

  const products = await prisma.crmProduct.findMany({
    where: { userId: user.id, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { name, sku, description, price, unit, taxRate } = body;
  if (!name?.trim()) return NextResponse.json({ error: "نام محصول الزامی است" }, { status: 400 });
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "قیمت معتبر الزامی است" }, { status: 400 });
  }

  const product = await prisma.crmProduct.create({
    data: {
      userId: user.id,
      name: name.trim(),
      sku: sku || undefined,
      description: description || undefined,
      price,
      unit: unit || undefined,
      taxRate: typeof taxRate === "number" ? taxRate : 0,
    },
  });
  return NextResponse.json({ product });
}
