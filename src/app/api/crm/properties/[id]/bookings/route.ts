export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.shortTermCalendar");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const bookings = await prisma.propertyBooking.findMany({
    where: { propertyId: params.id },
    include: { contact: { select: { id: true, name: true, phone: true } } },
    orderBy: { checkIn: "asc" },
  });

  return NextResponse.json({ bookings, bookingLink: property.bookingLink });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const { checkIn, checkOut, guestName, contactId, notes } = body;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (!checkIn || !checkOut || isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return NextResponse.json({ error: tri(lang, "تاریخ ورود و خروج نامعتبر است", "Invalid check-in/check-out date", "Ungültiges Check-in-/Check-out-Datum") }, { status: 400 });
  }
  if (checkOutDate <= checkInDate) {
    return NextResponse.json({ error: tri(lang, "تاریخ خروج باید بعد از تاریخ ورود باشد", "Check-out date must be after check-in date", "Das Check-out-Datum muss nach dem Check-in-Datum liegen") }, { status: 400 });
  }

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId } });
    if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب یافت نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });
  }

  // Double-booking guard: any confirmed booking on this property whose
  // [checkIn, checkOut) range overlaps the requested one.
  const conflict = await prisma.propertyBooking.findFirst({
    where: {
      propertyId: params.id,
      status: "confirmed",
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
  });
  if (conflict) {
    return NextResponse.json({
      error: tri(
        lang,
        `این بازه با یک رزرو دیگر تداخل دارد (${conflict.checkIn.toISOString().slice(0, 10)} تا ${conflict.checkOut.toISOString().slice(0, 10)})`,
        `This range overlaps another booking (${conflict.checkIn.toISOString().slice(0, 10)} to ${conflict.checkOut.toISOString().slice(0, 10)})`,
        `Dieser Zeitraum überschneidet sich mit einer anderen Buchung (${conflict.checkIn.toISOString().slice(0, 10)} bis ${conflict.checkOut.toISOString().slice(0, 10)})`
      ),
      conflict: { id: conflict.id, checkIn: conflict.checkIn, checkOut: conflict.checkOut },
    }, { status: 409 });
  }

  const booking = await prisma.propertyBooking.create({
    data: {
      userId: ws.workspaceUserId,
      propertyId: params.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guestName: guestName || undefined,
      contactId: contactId || undefined,
      notes: notes || undefined,
    },
  });

  return NextResponse.json({ booking });
}
