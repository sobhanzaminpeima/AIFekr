export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { voiceScope } from "@/lib/voice-studio/service";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "image";

  let items: unknown[] = [];

  // Capped — a heavy user's gallery grows with every generation and would
  // otherwise load unbounded rows on every page view.
  if (type === "image") {
    items = await prisma.generatedImage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } else if (type === "video") {
    items = await prisma.generatedVideo.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } else if (type === "music") {
    items = await prisma.generatedMusic.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } else if (type === "voice") {
    // Finished Voice Studio audio in the account's current workspace; the file
    // itself is served by /api/voice-studio?audio=<id> (a signed, private link).
    const rows = await prisma.voiceStudioGeneration.findMany({
      where: { ...(await voiceScope(user.id)), status: "READY", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, text: true, projectId: true, durationMs: true, createdAt: true },
    });
    items = rows.map((r) => ({ id: r.id, prompt: r.text.slice(0, 200), url: `/api/voice-studio?audio=${r.id}`, projectId: r.projectId, durationMs: r.durationMs, createdAt: r.createdAt }));
  }

  return NextResponse.json({ items });
}
