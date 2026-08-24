export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.shortTermCalendar");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

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
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { checkIn, checkOut, guestName, contactId, notes } = body;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (!checkIn || !checkOut || isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return NextResponse.json({ error: "تاریخ ورود و خروج نامعتبر است" }, { status: 400 });
  }
  if (checkOutDate <= checkInDate) {
    return NextResponse.json({ error: "تاریخ خروج باید بعد از تاریخ ورود باشد" }, { status: 400 });
  }

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
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
      error: `این بازه با یک رزرو دیگر تداخل دارد (${conflict.checkIn.toISOString().slice(0, 10)} تا ${conflict.checkOut.toISOString().slice(0, 10)})`,
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
