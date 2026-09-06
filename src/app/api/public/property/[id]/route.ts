export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/** Public, unauthenticated — powers the shareable /p/[id] lead-capture landing page. Only listing fields a buyer/renter needs to see, never owner/agent internal data. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: {
      // `currency` is required, not cosmetic: the page used to print every
      // price as Toman with Persian numerals, so a EUR/TRY/USD listing was
      // shown to the agent's own client in the wrong currency entirely.
      id: true, title: true, listingType: true, propertyType: true, price: true, nightlyPrice: true, currency: true,
      address: true, city: true, bedrooms: true, bathrooms: true, areaSqm: true, description: true, status: true,
    },
  });
  if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });

  return NextResponse.json({
    property: { ...property, price: Number(property.price), nightlyPrice: property.nightlyPrice != null ? Number(property.nightlyPrice) : null },
  });
}
