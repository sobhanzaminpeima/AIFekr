export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "image";

  let items: unknown[] = [];

  if (type === "image") {
    items = await prisma.generatedImage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  } else if (type === "video") {
    items = await prisma.generatedVideo.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  } else if (type === "music") {
    items = await prisma.generatedMusic.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ items });
}
