export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

function serialize(p: { price: bigint; nightlyPrice: bigint | null; [k: string]: unknown }) {
  return { ...p, price: Number(p.price), nightlyPrice: p.nightlyPrice != null ? Number(p.nightlyPrice) : null };
}

async function checkPropertyModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.property");
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { title, propertyType, price, nightlyPrice, bookingLink, address, city, bedrooms, bathrooms, areaSqm, description, images, status, crmContactId, crmDealId } = body;

  let resolvedBookingLink: string | undefined;
  let bookingLinkWarning: string | null = null;
  if (bookingLink) {
    try {
      resolvedBookingLink = new URL(bookingLink).toString();
    } catch {
      bookingLinkWarning = "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد";
    }
  }

  const property = await prisma.property.update({
    where: { id: params.id },
    data: {
      title: title !== undefined ? title.trim() : undefined,
      propertyType: propertyType || undefined,
      price: price !== undefined ? BigInt(Math.round(Number(price) || 0)) : undefined,
      nightlyPrice: nightlyPrice !== undefined ? (nightlyPrice != null ? BigInt(Math.round(Number(nightlyPrice))) : null) : undefined,
      bookingLink: bookingLink !== undefined ? resolvedBookingLink : undefined,
      address: address !== undefined ? address.trim() : undefined,
      city: city !== undefined ? city : undefined,
      bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
      bathrooms: bathrooms !== undefined ? Number(bathrooms) : undefined,
      areaSqm: areaSqm !== undefined ? Number(areaSqm) : undefined,
      description: description !== undefined ? description : undefined,
      images: images !== undefined ? (Array.isArray(images) ? JSON.stringify(images) : null) : undefined,
      status: status || undefined,
      crmContactId: crmContactId !== undefined ? (crmContactId || null) : undefined,
      crmDealId: crmDealId !== undefined ? (crmDealId || null) : undefined,
    },
  });

  return NextResponse.json({ property: serialize(property), bookingLinkWarning });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  await prisma.property.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
