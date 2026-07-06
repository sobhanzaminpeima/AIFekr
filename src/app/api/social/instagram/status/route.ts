export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { canAutoPublish } from "@/lib/utils/planGates";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
  const posts = await prisma.scheduledPost.findMany({ where: { userId: user.id }, orderBy: { scheduledFor: "desc" }, take: 20 });

  return NextResponse.json({
    connected: !!conn,
    igUsername: conn?.igUsername || null,
    canAutoPublish: canAutoPublish(user.plan),
    posts,
  });
}
