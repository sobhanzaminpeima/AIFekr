export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";

/**
 * Public, unauthenticated lead-capture endpoint for the shareable per-property
 * link (item 1, batch2 — real-estate lead generation MVP). Anyone with the
 * link can submit; the resulting CrmContact is tagged "از این ملک" (from
 * this property) and its sourceDetails records which property, so an agent
 * sees exactly where the lead came from without any Meta Ads/Business
 * Manager integration.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });

  const { propertyId, name, phone, message } = body;
  if (!propertyId || !name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "نام و شماره تماس الزامی است" }, { status: 400 });
  }
  if (looksLikeInjectionAttempt(name) || (message && looksLikeInjectionAttempt(message))) {
    return NextResponse.json({ error: "محتوای نامعتبر" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const contact = await prisma.crmContact.create({
    data: {
      userId: property.userId,
      name: name.trim(),
      phone: phone.trim(),
      status: "lead",
      source: "property_link",
      sourceDetails: JSON.stringify({ propertyId, propertyTitle: property.title }),
      tags: "از این ملک",
      notes: message?.trim() || undefined,
    },
  });

  await prisma.property.update({ where: { id: propertyId }, data: { crmContactId: contact.id } }).catch(() => {});

  return NextResponse.json({ success: true });
}
