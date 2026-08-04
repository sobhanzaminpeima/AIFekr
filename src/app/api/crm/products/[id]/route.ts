export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmProduct.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { name, sku, description, price, unit, taxRate, isActive } = body;
  if (price !== undefined && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) {
    return NextResponse.json({ error: "قیمت معتبر الزامی است" }, { status: 400 });
  }

  const product = await prisma.crmProduct.update({
    where: { id: params.id },
    data: {
      name: name?.trim() || undefined,
      sku: sku !== undefined ? sku : undefined,
      description: description !== undefined ? description : undefined,
      price: price !== undefined ? price : undefined,
      unit: unit !== undefined ? unit : undefined,
      taxRate: typeof taxRate === "number" ? taxRate : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
  });
  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const existing = await prisma.crmProduct.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmProduct.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
