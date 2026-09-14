export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/** Error events for the /admin/logs "errors" tab. See lib/logging/errorLog.ts. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  const level = req.nextUrl.searchParams.get("level");

  const errors = await prisma.errorLog.findMany({
    where: level === "error" || level === "warn" ? { level } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, level: true, source: true, message: true, stack: true, userId: true, requestId: true, createdAt: true },
  });

  return NextResponse.json({ errors });
}
