export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { voiceScope } from "@/lib/voice-studio/service";
import { libraryIndex } from "@/lib/library";

const TAKE = 60;

/** E1, first slice: the signed-in user's creations across modules, newest first. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const latest = { orderBy: { createdAt: "desc" as const }, take: TAKE };
  const [images, videos, music, voice, seo, websites] = await Promise.all([
    prisma.generatedImage.findMany({ where: { userId: user.id }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.generatedVideo.findMany({ where: { userId: user.id, refunded: false }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.generatedMusic.findMany({ where: { userId: user.id, refunded: false }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.voiceStudioGeneration.findMany({ where: { ...(await voiceScope(user.id)), status: "READY", deletedAt: null }, ...latest, select: { id: true, text: true, createdAt: true } }),
    prisma.seoGeneration.findMany({ where: { userId: user.id }, ...latest, select: { id: true, tool: true, keyword: true, url: true, createdAt: true } }),
    prisma.generatedWebsite.findMany({ where: { userId: user.id }, ...latest, select: { id: true, businessName: true, createdAt: true } }),
  ]);
  return NextResponse.json({ items: libraryIndex({ images, videos, music, voice, seo, websites }, TAKE) });
}
