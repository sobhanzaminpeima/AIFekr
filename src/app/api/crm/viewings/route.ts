export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { suggestViewingSlot } from "@/lib/agents/viewingCoordinator";

// Same conflict window the Voice Agent's phone-booking flow already uses
// (src/app/api/webhooks/vapi/route.ts) — kept consistent rather than
// inventing a different threshold for the CRM-side scheduler.
const CONFLICT_WINDOW_MS = 30 * 60 * 1000;

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string, moduleKey: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, moduleKey);
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId, "crm.viewingScheduler"))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const status = searchParams.get("status");

  const viewings = await prisma.propertyViewing.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(propertyId ? { propertyId } : {}),
      ...(status ? { status } : {}),
      ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}),
    },
    include: {
      property: { select: { id: true, title: true, address: true } },
      contact: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });

  return NextResponse.json({ viewings });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId, "crm.viewingScheduler"))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  const body = await req.json();
  const { propertyId, contactId, assignedToId, scheduledAt, durationMin, autoSlot } = body;

  if (!propertyId) return NextResponse.json({ error: "ملک الزامی است" }, { status: 400 });
  const requestedDate = new Date(scheduledAt);
  if (!scheduledAt || isNaN(requestedDate.getTime())) return NextResponse.json({ error: "زمان بازدید نامعتبر است" }, { status: 400 });

  const property = await prisma.property.findFirst({ where: { id: propertyId, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }

  let scheduledDate = requestedDate;
  let autoRescheduled = false;

  if (assignedToId && autoSlot) {
    // Section 2, item 3 — Viewing Coordinator: booking a single slot may
    // happen automatically (low risk) as long as a real free slot was
    // found — if the calendar is fully booked within the search window,
    // this returns null and we fail with a clear message instead of
    // guessing a time, per the "warn and wait for manual confirmation"
    // requirement.
    if (!(await isModuleEnabled({ id: user.id, role: user.role, industryPackId: (await prisma.user.findUnique({ where: { id: ws.workspaceUserId }, select: { industryPackId: true } }))?.industryPackId ?? null }, "agent.viewingCoordinator"))) {
      return NextResponse.json({ error: "ماژول هماهنگ‌کننده بازدید برای شما فعال نیست" }, { status: 403 });
    }
    const suggestion = await suggestViewingSlot(ws.workspaceUserId, assignedToId, requestedDate);
    if (!suggestion) {
      return NextResponse.json({ error: "تقویم این کارشناس در این بازه کاملاً پر است — لطفاً زمان دیگری را دستی انتخاب کنید" }, { status: 409 });
    }
    scheduledDate = suggestion.scheduledAt;
    autoRescheduled = suggestion.wasRescheduled;
  } else if (assignedToId) {
    // Double-booking guard — only meaningful once a human agent is assigned;
    // an unassigned viewing slot can't conflict with anyone's calendar yet.
    const conflict = await prisma.propertyViewing.findFirst({
      where: {
        userId: ws.workspaceUserId,
        assignedToId,
        status: { in: ["scheduled"] },
        scheduledAt: {
          gte: new Date(scheduledDate.getTime() - CONFLICT_WINDOW_MS),
          lte: new Date(scheduledDate.getTime() + CONFLICT_WINDOW_MS),
        },
      },
      orderBy: { scheduledAt: "asc" },
    });
    if (conflict) {
      return NextResponse.json({
        error: `این بازه زمانی برای این کارشناس قبلاً رزرو شده است (بازدید دیگری در ${conflict.scheduledAt.toLocaleString("fa-IR")} ثبت شده)`,
        conflict: { id: conflict.id, scheduledAt: conflict.scheduledAt },
      }, { status: 409 });
    }
  }

  const viewing = await prisma.propertyViewing.create({
    data: {
      userId: ws.workspaceUserId,
      propertyId,
      contactId: contactId || undefined,
      assignedToId: assignedToId || undefined,
      scheduledAt: scheduledDate,
      durationMin: durationMin ? Number(durationMin) : undefined,
    },
  });

  return NextResponse.json({ viewing, autoRescheduled });
}
