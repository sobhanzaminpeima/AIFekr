export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const sites = await prisma.generatedWebsite.findMany({
    where: { userId: user.id },
    select: { id: true, businessName: true, brief: true, createdAt: true, htmlCode: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    sites: sites.map((s) => ({
      id: s.id,
      businessName: s.businessName,
      createdAt: s.createdAt,
      sizeKB: Math.round((s.htmlCode.length / 1024) * 10) / 10,
    })),
  });
}
