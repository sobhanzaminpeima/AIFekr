export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "1";

  const products = await prisma.crmProduct.findMany({
    where: { userId: ws.workspaceUserId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const body = await req.json();
  const { name, sku, description, price, unit, taxRate, imageUrl } = body;
  if (!name?.trim()) return NextResponse.json({ error: tri(lang, "نام محصول الزامی است", "Product name is required", "Produktname ist erforderlich") }, { status: 400 });
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: tri(lang, "قیمت معتبر الزامی است", "A valid price is required", "Ein gültiger Preis ist erforderlich") }, { status: 400 });
  }

  const product = await prisma.crmProduct.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      sku: sku || undefined,
      description: description || undefined,
      price,
      unit: unit || undefined,
      taxRate: typeof taxRate === "number" ? taxRate : 0,
      imageUrl: imageUrl || undefined,
    },
  });
  return NextResponse.json({ product });
}
