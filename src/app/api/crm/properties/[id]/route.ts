export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

function serialize(p: { price: bigint; nightlyPrice: bigint | null; [k: string]: unknown }) {
  return { ...p, price: Number(p.price), nightlyPrice: p.nightlyPrice != null ? Number(p.nightlyPrice) : null };
}

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string, moduleKey: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, moduleKey);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId, "crm.property"))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const existing = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const { title, propertyType, price, nightlyPrice, currency, bookingLink, address, city, bedrooms, bathrooms, areaSqm, description, images, status, crmContactId, crmDealId, representationStartDate, representationEndDate, agreedCommissionRate } = body;
  if (currency !== undefined && !["IRT", "IRR", "USD", "GBP", "EUR"].includes(currency)) {
    return NextResponse.json({ error: tri(lang, "واحد پولی نامعتبر است", "Invalid currency", "Ungültige Währung") }, { status: 400 });
  }

  const touchesOwnerFields = representationStartDate !== undefined || representationEndDate !== undefined || agreedCommissionRate !== undefined;
  if (touchesOwnerFields && !(await checkModuleAccess(user.id, user.role, ws.workspaceUserId, "crm.owner"))) {
    return NextResponse.json({ error: tri(lang, "ماژول مدیریت مالک برای شما فعال نیست", "The Owner Management module is not enabled for you", "Das Modul Eigentümerverwaltung ist für Sie nicht aktiviert") }, { status: 403 });
  }

  let resolvedBookingLink: string | undefined;
  let bookingLinkWarning: string | null = null;
  if (bookingLink) {
    try {
      resolvedBookingLink = new URL(bookingLink).toString();
    } catch {
      bookingLinkWarning = tri(lang, "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد", "The booking platform link doesn't look valid", "Der Buchungsplattform-Link scheint ungültig zu sein");
    }
  }

  const property = await prisma.property.update({
    where: { id: params.id },
    data: {
      title: title !== undefined ? title.trim() : undefined,
      propertyType: propertyType || undefined,
      price: price !== undefined ? BigInt(Math.round(Number(price) || 0)) : undefined,
      nightlyPrice: nightlyPrice !== undefined ? (nightlyPrice != null ? BigInt(Math.round(Number(nightlyPrice))) : null) : undefined,
      currency: currency || undefined,
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
      representationStartDate: representationStartDate !== undefined ? (representationStartDate ? new Date(representationStartDate) : null) : undefined,
      representationEndDate: representationEndDate !== undefined ? (representationEndDate ? new Date(representationEndDate) : null) : undefined,
      agreedCommissionRate: agreedCommissionRate !== undefined ? (agreedCommissionRate != null ? Number(agreedCommissionRate) : null) : undefined,
    },
  });

  return NextResponse.json({ property: serialize(property), bookingLinkWarning });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId, "crm.property"))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const existing = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  await prisma.property.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
