export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

const CONFLICT_WINDOW_MS = 30 * 60 * 1000;

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.viewingScheduler");
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.propertyViewing.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "بازدید یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { scheduledAt, assignedToId, contactId, status, feedback, feedbackRating } = body;

  let scheduledDate: Date | undefined;
  if (scheduledAt !== undefined) {
    scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) return NextResponse.json({ error: "زمان بازدید نامعتبر است" }, { status: 400 });
  }

  // Re-check the double-booking window whenever the time or the assigned
  // agent changes — a reschedule can create the exact same conflict a
  // fresh booking would.
  const nextAssignee = assignedToId !== undefined ? assignedToId : existing.assignedToId;
  const nextTime = scheduledDate ?? existing.scheduledAt;
  if (nextAssignee && (scheduledDate || assignedToId !== undefined)) {
    const conflict = await prisma.propertyViewing.findFirst({
      where: {
        userId: ws.workspaceUserId,
        assignedToId: nextAssignee,
        status: { in: ["scheduled"] },
        id: { not: params.id },
        scheduledAt: {
          gte: new Date(nextTime.getTime() - CONFLICT_WINDOW_MS),
          lte: new Date(nextTime.getTime() + CONFLICT_WINDOW_MS),
        },
      },
    });
    if (conflict) {
      return NextResponse.json({
        error: `این بازه زمانی برای این کارشناس قبلاً رزرو شده است (بازدید دیگری در ${conflict.scheduledAt.toLocaleString("fa-IR")} ثبت شده)`,
      }, { status: 409 });
    }
  }

  const viewing = await prisma.propertyViewing.update({
    where: { id: params.id },
    data: {
      scheduledAt: scheduledDate,
      assignedToId: assignedToId !== undefined ? (assignedToId || null) : undefined,
      contactId: contactId !== undefined ? (contactId || null) : undefined,
      status: status || undefined,
      feedback: feedback !== undefined ? feedback : undefined,
      feedbackRating: feedbackRating !== undefined ? (feedbackRating != null ? Number(feedbackRating) : null) : undefined,
    },
  });

  return NextResponse.json({ viewing });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const existing = await prisma.propertyViewing.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: "بازدید یافت نشد" }, { status: 404 });

  await prisma.propertyViewing.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
