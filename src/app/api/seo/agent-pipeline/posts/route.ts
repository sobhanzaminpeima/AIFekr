export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const posts = await prisma.contentPost.findMany({
    where: { userId: user.id },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ posts });
}
