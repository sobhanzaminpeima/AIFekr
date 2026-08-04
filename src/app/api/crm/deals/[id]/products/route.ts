export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const deal = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!deal) return NextResponse.json({ error: "معامله پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const { productId, quantity } = body;
  const product = await prisma.crmProduct.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });

  const qty = typeof quantity === "number" && quantity > 0 ? quantity : 1;
  const dealProduct = await prisma.crmDealProduct.create({
    data: { dealId: deal.id, productId: product.id, quantity: qty, priceAtSale: product.price },
    include: { product: true },
  });
  return NextResponse.json({ dealProduct });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const deal = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!deal) return NextResponse.json({ error: "معامله پیدا نشد" }, { status: 404 });

  const dealProducts = await prisma.crmDealProduct.findMany({ where: { dealId: deal.id }, include: { product: true } });
  return NextResponse.json({ dealProducts });
}
