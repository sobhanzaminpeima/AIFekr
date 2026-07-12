export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { ceoAutoRunEnabled: true } });
  return NextResponse.json({ enabled: u?.ceoAutoRunEnabled ?? false });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const { enabled } = await req.json();
  await prisma.user.update({ where: { id: user.id }, data: { ceoAutoRunEnabled: !!enabled } });
  return NextResponse.json({ enabled: !!enabled });
}
