export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Registers a buyer/tenant lead as interested in a specific property this
 * agency already has — "customers looking for properties I have."
 * Deliberately separate from Property.crmContactId (the owner/seller
 * link, Section 1 item 2): an owner and an interested buyer are never the
 * same relationship, even when they happen to be the same contact record.
 */
async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.property");
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

  const interests = await prisma.propertyInterest.findMany({
    where: { propertyId: params.id },
    include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ interests });
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
  let contactId: string | undefined = body.contactId;
  const note: string | undefined = body.note?.trim() || undefined;

  if (!contactId) {
    // Register a brand-new customer in one step, same "create + link" shape
    // as the owner flow — the agent shouldn't need a separate trip to the
    // Contacts tab first.
    const name: string | undefined = body.name?.trim();
    if (!name) return NextResponse.json({ error: tri(lang, "نام مشتری یا شناسه مخاطب الزامی است", "Customer name or contact ID is required", "Kundenname oder Kontakt-ID ist erforderlich") }, { status: 400 });
    const contact = await prisma.crmContact.create({
      data: { userId: ws.workspaceUserId, name, phone: body.phone?.trim() || undefined, email: body.email?.trim() || undefined, status: "lead", assignedToId: ws.isAgentRestricted ? ws.actingUserId : undefined },
      select: { id: true },
    });
    contactId = contact.id;
  } else {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) }, select: { id: true } });
    if (!contact) return NextResponse.json({ error: tri(lang, "مخاطب یافت نشد", "Contact not found", "Kontakt nicht gefunden") }, { status: 404 });
  }

  const interest = await prisma.propertyInterest.upsert({
    where: { propertyId_contactId: { propertyId: params.id, contactId } },
    create: { userId: ws.workspaceUserId, propertyId: params.id, contactId, note },
    update: { note },
    include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
  });
  return NextResponse.json({ interest });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const { contactId } = await req.json();
  const existing = await prisma.propertyInterest.findFirst({ where: { propertyId: params.id, contactId, userId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  await prisma.propertyInterest.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
