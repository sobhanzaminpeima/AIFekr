export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const EDITABLE_FIELDS = ["name", "status", "description"] as const;

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const existing = await prisma.crmProject.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if ("endDate" in body) data.endDate = body.endDate ? new Date(body.endDate) : null;

  const project = await prisma.crmProject.update({ where: { id: params.id }, data });

  // Real-estate linked-Property update — same warn-not-block rule as create.
  let bookingLinkWarning: string | null = null;
  if (body.realEstate) {
    const { propertyType, price, nightlyPrice, bookingLink: rawBookingLink, address, city } = body.realEstate;
    let bookingLink: string | undefined;
    if (rawBookingLink) {
      try {
        bookingLink = new URL(rawBookingLink).toString();
      } catch {
        bookingLinkWarning = tri(lang, "لینک پلتفرم رزرو معتبر به‌نظر نمی‌رسد — بعداً می‌توانید اصلاحش کنید", "The booking platform link doesn't look valid — you can fix it later", "Der Buchungsplattform-Link scheint ungültig zu sein — Sie können ihn später korrigieren");
      }
    } else if (rawBookingLink === "") {
      bookingLink = "";
    }
    const property = await prisma.property.findFirst({ where: { crmProjectId: params.id } });
    if (property) {
      await prisma.property.update({
        where: { id: property.id },
        data: {
          propertyType: propertyType || undefined,
          price: price != null ? BigInt(Math.round(Number(price))) : undefined,
          nightlyPrice: nightlyPrice != null ? BigInt(Math.round(Number(nightlyPrice))) : undefined,
          bookingLink,
          address: address || undefined,
          city: city || undefined,
        },
      });
    }
  }

  return NextResponse.json({ project, bookingLinkWarning });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const existing = await prisma.crmProject.findFirst({
    where: { id: params.id, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { contact: { assignedToId: ws.actingUserId } } : {}) },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.crmProject.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
