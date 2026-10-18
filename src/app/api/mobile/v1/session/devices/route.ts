import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const sessions = await prisma.mobileSession.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true, expiresAt: true }, orderBy: { lastUsedAt: "desc" }, take: 50 });
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  const body = await req.json().catch(() => null);
  if (body?.all !== true && typeof body?.id !== "string") return NextResponse.json({ error: "Session id or all required" }, { status: 400 });
  await prisma.mobileSession.updateMany({ where: { userId: user.id, ...(body.all === true ? {} : { id: body.id }), revokedAt: null }, data: { revokedAt: new Date() } });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
