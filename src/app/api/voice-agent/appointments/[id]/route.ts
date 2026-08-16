export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const existing = await prisma.voiceAppointment.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "رزرو یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { status, scheduledAt, notes } = body;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  const updated = await prisma.voiceAppointment.update({
    where: { id },
    data: {
      status: status || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      notes: notes === undefined ? undefined : notes || null,
    },
  });
  return NextResponse.json({ appointment: updated });
}
