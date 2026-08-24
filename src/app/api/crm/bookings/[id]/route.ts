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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.propertyBooking.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "رزرو یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { checkIn, checkOut, status, guestName, notes } = body;

  let checkInDate: Date | undefined;
  let checkOutDate: Date | undefined;
  if (checkIn !== undefined) checkInDate = new Date(checkIn);
  if (checkOut !== undefined) checkOutDate = new Date(checkOut);

  const nextCheckIn = checkInDate ?? existing.checkIn;
  const nextCheckOut = checkOutDate ?? existing.checkOut;
  const nextStatus = status !== undefined ? status : existing.status;

  if ((checkInDate || checkOutDate) && nextStatus === "confirmed") {
    if (nextCheckOut <= nextCheckIn) {
      return NextResponse.json({ error: "تاریخ خروج باید بعد از تاریخ ورود باشد" }, { status: 400 });
    }
    const conflict = await prisma.propertyBooking.findFirst({
      where: {
        propertyId: existing.propertyId,
        status: "confirmed",
        id: { not: params.id },
        checkIn: { lt: nextCheckOut },
        checkOut: { gt: nextCheckIn },
      },
    });
    if (conflict) {
      return NextResponse.json({
        error: `این بازه با یک رزرو دیگر تداخل دارد (${conflict.checkIn.toISOString().slice(0, 10)} تا ${conflict.checkOut.toISOString().slice(0, 10)})`,
      }, { status: 409 });
    }
  }

  const booking = await prisma.propertyBooking.update({
    where: { id: params.id },
    data: {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status: status || undefined,
      guestName: guestName !== undefined ? guestName : undefined,
      notes: notes !== undefined ? notes : undefined,
    },
  });

  return NextResponse.json({ booking });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.propertyBooking.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "رزرو یافت نشد" }, { status: 404 });

  await prisma.propertyBooking.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
