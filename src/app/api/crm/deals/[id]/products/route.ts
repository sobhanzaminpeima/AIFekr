export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess, dealAgentFilter } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const deal = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const { productId, quantity } = body;
  const product = await prisma.crmProduct.findFirst({ where: { id: productId, userId: ws.workspaceUserId } });
  if (!product) return NextResponse.json({ error: tri(lang, "محصول پیدا نشد", "Product not found", "Produkt nicht gefunden") }, { status: 404 });

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
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const deal = await prisma.crmDeal.findFirst({ where: { id: params.id, userId: ws.workspaceUserId, ...dealAgentFilter(ws) } });
  if (!deal) return NextResponse.json({ error: tri(lang, "معامله پیدا نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });

  const dealProducts = await prisma.crmDealProduct.findMany({ where: { dealId: deal.id }, include: { product: true } });
  return NextResponse.json({ dealProducts });
}
