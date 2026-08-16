export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { serializeVoiceProperty } from "@/lib/voice/workspace";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const existing = await prisma.voiceProperty.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const body = await req.json();
  const { title, price, address, city, bedrooms, bathrooms, areaSqm, description, status } = body;

  const updated = await prisma.voiceProperty.update({
    where: { id },
    data: {
      title: typeof title === "string" && title.trim() ? title.trim() : undefined,
      price: typeof price === "number" ? BigInt(Math.round(price)) : undefined,
      address: typeof address === "string" && address.trim() ? address.trim() : undefined,
      city: city === undefined ? undefined : city || null,
      bedrooms: bedrooms === undefined ? undefined : bedrooms,
      bathrooms: bathrooms === undefined ? undefined : bathrooms,
      areaSqm: areaSqm === undefined ? undefined : areaSqm,
      description: description === undefined ? undefined : description || null,
      status: typeof status === "string" ? status : undefined,
    },
  });
  return NextResponse.json({ property: serializeVoiceProperty(updated) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { id } = await params;

  const existing = await prisma.voiceProperty.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  await prisma.voiceProperty.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
