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

  const properties = await prisma.voiceProperty.findMany({
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

  const property = await prisma.voiceProperty.create({
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
  return NextResponse.json({ property: serializeVoiceProperty(property) });
}
