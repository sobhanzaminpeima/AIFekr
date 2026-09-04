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
  const contactId = searchParams.get("contactId");
  const status = searchParams.get("status");

  const projects = await prisma.crmProject.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(status ? { status } : {}),
      ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}),
    },
    include: {
      contact: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
      property: { select: { id: true, listingType: true, propertyType: true, price: true, nightlyPrice: true, bookingLink: true, address: true, city: true, areaSqm: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({
    projects: projects.map((p) => ({
      ...p,
      property: p.property[0] ? { ...p.property[0], price: Number(p.property[0].price), nightlyPrice: p.property[0].nightlyPrice != null ? Number(p.property[0].nightlyPrice) : null } : null,
    })),
  });
}

/// A real-estate project always represents something this business is
/// selling/renting out — never something they're buying — so only these 3
/// of Property.listingType's 4 possible values are valid here.
const PROJECT_LISTING_TYPES = ["sell", "rent", "short_term_rent"];

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const body = await req.json();
  const { name, contactId, dealId, status, startDate, endDate, description, realEstate } = body;
  if (!name?.trim()) return NextResponse.json({ error: tri(lang, "نام پروژه الزامی است", "Project name is required", "Projektname ist erforderlich") }, { status: 400 });

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب یافت نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { ownerId: ws.actingUserId } : {}) } });
    if (!deal) return NextResponse.json({ error: tri(lang, "معامله یافت نشد", "Deal not found", "Deal nicht gefunden") }, { status: 404 });
  }

  // Real-estate industry-pack extra: attach a linked Property row instead of
  // adding real-estate-only columns to CrmProject itself — the unified
  // Property model (see Voice Agent) is the single source of truth for
  // listing/pricing data, CRM only ever links to it.
  let dealType: string | undefined;
  if (realEstate?.dealType) {
    if (!PROJECT_LISTING_TYPES.includes(realEstate.dealType)) {
      return NextResponse.json({ error: tri(lang, "نوع معامله نامعتبر است", "Invalid listing type", "Ungültiger Angebotstyp") }, { status: 400 });
    }
    dealType = realEstate.dealType;
  }
  // A malformed booking link is a warning, not a save-blocking validation
  // error — an agent may want to create the project before the listing URL
  // exists. We just don't store something that isn't even URL-shaped.
  let bookingLinkWarning: string | null = null;
  let bookingLink: string | undefined;
  if (realEstate?.bookingLink) {
    try {
      bookingLink = new URL(realEstate.bookingLink).toString();
    } catch {
      bookingLinkWarning = tri(lang, "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد — بعداً می‌توانید اصلاحش کنید", "The booking platform link doesn't look valid — you can fix it later", "Der Buchungsplattform-Link scheint ungültig zu sein — Sie können ihn später korrigieren");
    }
  }

  const project = await prisma.crmProject.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      contactId: contactId || undefined,
      dealId: dealId || undefined,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      description: description || undefined,
      ...(dealType
        ? {
            property: {
              create: {
                userId: ws.workspaceUserId,
                title: name.trim(),
                listingType: dealType,
                propertyType: realEstate.propertyType || "apartment",
                price: dealType === "short_term_rent" ? BigInt(0) : BigInt(Math.round(Number(realEstate.price) || 0)),
                nightlyPrice: dealType === "short_term_rent" && realEstate.nightlyPrice ? BigInt(Math.round(Number(realEstate.nightlyPrice))) : undefined,
                bookingLink,
                address: realEstate.address || "",
                city: realEstate.city || undefined,
                crmContactId: contactId || undefined,
                crmDealId: dealId || undefined,
              },
            },
          }
        : {}),
    },
  });
  return NextResponse.json({ project, bookingLinkWarning });
}
