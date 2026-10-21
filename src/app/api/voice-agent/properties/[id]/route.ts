export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { prisma } from "@/lib/db/prisma";
import { serializeVoiceProperty } from "@/lib/voice/workspace";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id || existing.businessId !== await activeBusinessIdFor(user.id))) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  const body = await req.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request"},{status:400});
  const { title, price, address, city, bedrooms, bathrooms, areaSqm, description, status } = body;

  if(price!==undefined&&(!Number.isFinite(price)||price<=0||price>Number.MAX_SAFE_INTEGER)) return NextResponse.json({error:"Invalid price"},{status:400});
  if(status!==undefined&&!["available","pending","sold","rented"].includes(status)) return NextResponse.json({error:"Invalid status"},{status:400});
  for(const [key,max] of [["city",300],["description",20000],["propertyType",100],["agentId",200]] as const){const v=body[key];if(v!==undefined&&v!==null&&(typeof v!=="string"||v.length>max))return NextResponse.json({error:`Invalid ${key}`},{status:400});}
  for(const key of ["bedrooms","bathrooms"]){const v=body[key];if(v!==undefined&&v!==null&&(!Number.isInteger(v)||v<0||v>1000))return NextResponse.json({error:`Invalid ${key}`},{status:400});}
  if(areaSqm!==undefined&&areaSqm!==null&&(typeof areaSqm!=="number"||!Number.isFinite(areaSqm)||areaSqm<=0||areaSqm>1e9))return NextResponse.json({error:"Invalid area"},{status:400});

  const updated = await prisma.property.update({
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
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id || existing.businessId !== await activeBusinessIdFor(user.id))) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  await prisma.property.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
