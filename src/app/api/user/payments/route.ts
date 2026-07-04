export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, amount: true, plan: true, status: true, gateway: true, refId: true, createdAt: true },
  });

  return NextResponse.json({ payments });
}
