export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { serializeVoiceProperty } from "@/lib/voice/workspace";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const properties = await prisma.property.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ properties: properties.map(serializeVoiceProperty) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  const { title, listingType, propertyType, price, address, city, bedrooms, bathrooms, areaSqm, description, agentId } = body;

  if (!title?.trim()) return NextResponse.json({ error: "عنوان ملک الزامی است" }, { status: 400 });
  if (!["buy", "sell", "rent"].includes(listingType)) return NextResponse.json({ error: "نوع معامله نامعتبر است" }, { status: 400 });
  if (!address?.trim()) return NextResponse.json({ error: "آدرس الزامی است" }, { status: 400 });
  if (typeof price !== "number" || price <= 0) return NextResponse.json({ error: "قیمت نامعتبر است" }, { status: 400 });

  if (agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) return NextResponse.json({ error: "ایجنت نامعتبر است" }, { status: 400 });
  }

  const property = await prisma.property.create({
    data: {
      userId: user.id,
      agentId: agentId || undefined,
      title: title.trim(),
      listingType,
      propertyType: propertyType?.trim() || "apartment",
      price: BigInt(Math.round(price)),
      address: address.trim(),
      city: city?.trim() || undefined,
      bedrooms: typeof bedrooms === "number" ? bedrooms : undefined,
      bathrooms: typeof bathrooms === "number" ? bathrooms : undefined,
      areaSqm: typeof areaSqm === "number" ? areaSqm : undefined,
      description: description?.trim() || undefined,
    },
  });

  // Internal lead-matching (item 1, batch2) — no external ad-platform
  // dependency: look for CRM contacts whose PAST property interest (any
  // Property row previously linked to them via crmContactId — from a voice
  // call, a property-link lead capture, etc.) resembles this new listing
  // (same city + type, price within ±20%), and surface them as "notify
  // these N leads" candidates. Best-effort — never blocks property creation.
  let matchedLeads: { contactId: string; contactName: string; phone: string | null }[] = [];
  try {
    const priceNum = Number(property.price);
    const priorInterest = await prisma.property.findMany({
      where: {
        userId: user.id,
        id: { not: property.id },
        crmContactId: { not: null },
        propertyType: property.propertyType,
        ...(property.city ? { city: property.city } : {}),
        price: { gte: BigInt(Math.round(priceNum * 0.8)), lte: BigInt(Math.round(priceNum * 1.2)) },
      },
      select: { crmContactId: true },
      distinct: ["crmContactId"],
      take: 5,
    });
    const contactIds = priorInterest.map((p) => p.crmContactId).filter((id): id is string => !!id);
    if (contactIds.length) {
      const contacts = await prisma.crmContact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, phone: true } });
      matchedLeads = contacts.map((c) => ({ contactId: c.id, contactName: c.name, phone: c.phone }));
    }
  } catch (err) {
    console.error("lead-matching failed (non-fatal):", err);
  }

  return NextResponse.json({ property: serializeVoiceProperty(property), matchedLeads });
}
