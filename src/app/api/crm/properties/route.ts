export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

const LISTING_TYPES = ["buy", "sell", "rent", "short_term_rent"];

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
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
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
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const body = await req.json();
  const { title, listingType, propertyType, price, nightlyPrice, bookingLink, address, city, bedrooms, bathrooms, areaSqm, description, images, crmContactId, crmDealId } = body;

  if (!title?.trim()) return NextResponse.json({ error: "عنوان ملک الزامی است" }, { status: 400 });
  if (!LISTING_TYPES.includes(listingType)) return NextResponse.json({ error: "نوع معامله نامعتبر است" }, { status: 400 });
  if (!address?.trim()) return NextResponse.json({ error: "آدرس الزامی است" }, { status: 400 });

  if (crmContactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: crmContactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: "مالک/مخاطب یافت نشد" }, { status: 404 });
  }
  if (crmDealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: crmDealId, userId: ws.workspaceUserId } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }

  let resolvedBookingLink: string | undefined;
  let bookingLinkWarning: string | null = null;
  if (bookingLink) {
    try {
      resolvedBookingLink = new URL(bookingLink).toString();
    } catch {
      bookingLinkWarning = "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد — بعداً می‌توانید اصلاحش کنید";
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
    },
  });

  return NextResponse.json({ property: serialize(property), bookingLinkWarning });
}
