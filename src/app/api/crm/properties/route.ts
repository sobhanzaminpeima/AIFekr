export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const LISTING_TYPES = ["buy", "sell", "rent", "short_term_rent"];
const CURRENCIES = ["IRT", "IRR", "USD", "GBP", "EUR", "TRY"];

function serialize(p: { price: bigint; nightlyPrice: bigint | null; [k: string]: unknown }) {
  return { ...p, price: Number(p.price), nightlyPrice: p.nightlyPrice != null ? Number(p.nightlyPrice) : null };
}

// The Properties module is real-estate-pack-gated (not a plain plan gate),
// so it needs the workspace owner's industryPackId (the pack governs the
// whole team, not just the acting user) alongside the acting user's own
// role/id for the admin-bypass and per-user-override checks.
async function checkPropertyModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.property");
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const listingType = searchParams.get("listingType");

  const properties = await prisma.property.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(status ? { status } : {}),
      ...(listingType ? { listingType } : {}),
      ...(ws.isAgentRestricted ? { crmContact: { assignedToId: ws.actingUserId } } : {}),
    },
    include: {
      crmContact: { select: { id: true, name: true, phone: true } },
      crmDeal: { select: { id: true, title: true } },
      // The owner-statements page used to show ownerContactId with no way to
      // tell WHO that was — only the CRM.property (sale-side) contact was
      // ever joined in. Now a real relation (see schema.prisma), so this is
      // just another include.
      ownerContact: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ properties: properties.map(serialize) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const body = await req.json();
  const { title, listingType, propertyType, price, nightlyPrice, currency, bookingLink, address, city, bedrooms, bathrooms, areaSqm, description, images, crmContactId, crmDealId, ownerContactId } = body;

  if (!title?.trim()) return NextResponse.json({ error: tri(lang, "عنوان ملک الزامی است", "Property title is required", "Immobilientitel ist erforderlich") }, { status: 400 });
  if (!LISTING_TYPES.includes(listingType)) return NextResponse.json({ error: tri(lang, "نوع معامله نامعتبر است", "Invalid listing type", "Ungültiger Angebotstyp") }, { status: 400 });
  if (!address?.trim()) return NextResponse.json({ error: tri(lang, "آدرس الزامی است", "Address is required", "Adresse ist erforderlich") }, { status: 400 });
  if (currency !== undefined && !CURRENCIES.includes(currency)) return NextResponse.json({ error: tri(lang, "واحد پولی نامعتبر است", "Invalid currency", "Ungültige Währung") }, { status: 400 });

  if (crmContactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: crmContactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: tri(lang, "مالک/مخاطب یافت نشد", "Owner/contact not found", "Eigentümer/Kontakt nicht gefunden") }, { status: 404 });
  }
  if (crmDealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: crmDealId, userId: ws.workspaceUserId } });
    if (!deal) return NextResponse.json({ error: tri(lang, "معامله یافت نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });
  }
  if (ownerContactId) {
    const owner = await prisma.crmContact.findFirst({ where: { id: ownerContactId, userId: ws.workspaceUserId } });
    if (!owner) return NextResponse.json({ error: tri(lang, "مالک/مخاطب یافت نشد", "Owner/contact not found", "Eigentümer/Kontakt nicht gefunden") }, { status: 404 });
  }

  let resolvedBookingLink: string | undefined;
  let bookingLinkWarning: string | null = null;
  if (bookingLink) {
    try {
      resolvedBookingLink = new URL(bookingLink).toString();
    } catch {
      bookingLinkWarning = tri(lang, "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد — بعداً می‌توانید اصلاحش کنید", "The booking platform link doesn't look valid — you can fix it later", "Der Buchungsplattform-Link scheint ungültig zu sein — Sie können ihn später korrigieren");
    }
  }

  const property = await prisma.property.create({
    data: {
      userId: ws.workspaceUserId,
      title: title.trim(),
      listingType,
      propertyType: propertyType || "apartment",
      price: listingType === "short_term_rent" ? BigInt(0) : BigInt(Math.round(Number(price) || 0)),
      nightlyPrice: listingType === "short_term_rent" && nightlyPrice ? BigInt(Math.round(Number(nightlyPrice))) : undefined,
      currency: currency || "IRT",
      bookingLink: resolvedBookingLink,
      address: address.trim(),
      city: city || undefined,
      bedrooms: bedrooms != null ? Number(bedrooms) : undefined,
      bathrooms: bathrooms != null ? Number(bathrooms) : undefined,
      areaSqm: areaSqm != null ? Number(areaSqm) : undefined,
      description: description || undefined,
      images: Array.isArray(images) ? JSON.stringify(images) : undefined,
      crmContactId: crmContactId || undefined,
      crmDealId: crmDealId || undefined,
      ownerContactId: ownerContactId || undefined,
    },
  });

  return NextResponse.json({ property: serialize(property), bookingLinkWarning });
}
