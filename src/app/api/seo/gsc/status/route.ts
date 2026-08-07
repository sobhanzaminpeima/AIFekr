export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conn = await prisma.gscConnection.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ connected: !!conn, siteUrl: conn?.siteUrl || null });
}
