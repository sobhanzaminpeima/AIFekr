export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

const VALID_TYPES = new Set(["image", "video", "music"]);

/**
 * Generalized version of the image-only /api/image/chat/conversations --
 * backs the unified creative studio (/create) that merges image/video/music
 * generation into one chat-per-media-type shell, matching the Noqte
 * reference the user sent. Same Conversation/Message reuse, tool tagged
 * "image" | "video" | "music".
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const type = req.nextUrl.searchParams.get("type") || "";
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "نوع نامعتبر است" }, { status: 400 });

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, tool: type },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { type, title } = await req.json().catch(() => ({}));
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "نوع نامعتبر است" }, { status: 400 });

  const conv = await prisma.conversation.create({
    data: { userId: user.id, tool: type, title: (title || "").slice(0, 60) || null, model: "auto" },
  });

  return NextResponse.json({ conversation: { id: conv.id, title: conv.title, updatedAt: conv.updatedAt } });
}
