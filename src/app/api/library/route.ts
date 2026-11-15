export const dynamic = "force-dynamic";
import { notifyFinishedFactoryJobs } from "@/lib/video-factory-hooks/finished";
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
  // Finished films notify their owner here too, so the library never shows one the user was not told about (E15).
  await notifyFinishedFactoryJobs(user.id).catch(() => 0);
  const [images, videos, music, voice, seo, websites, films] = await Promise.all([
    prisma.generatedImage.findMany({ where: { userId: user.id }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.generatedVideo.findMany({ where: { userId: user.id, refunded: false }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.generatedMusic.findMany({ where: { userId: user.id, refunded: false }, ...latest, select: { id: true, prompt: true, createdAt: true } }),
    prisma.voiceStudioGeneration.findMany({ where: { ...(await voiceScope(user.id)), status: "READY", deletedAt: null }, ...latest, select: { id: true, text: true, createdAt: true } }),
    prisma.seoGeneration.findMany({ where: { userId: user.id }, ...latest, select: { id: true, tool: true, keyword: true, url: true, createdAt: true } }),
    prisma.generatedWebsite.findMany({ where: { userId: user.id }, ...latest, select: { id: true, businessName: true, createdAt: true } }),
    prisma.videoFactoryJob.findMany({ where: { userId: user.id, status: "COMPLETED" }, orderBy: { updatedAt: "desc" }, take: TAKE, select: { id: true, projectId: true, updatedAt: true } }),
  ]);
  const titles = new Map((await prisma.videoFactoryProject.findMany({ where: { id: { in: [...new Set(films.map((f) => f.projectId))] }, deletedAt: null }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
  return NextResponse.json({ items: libraryIndex({ images, videos, music, voice, seo, websites, films: films.filter((f) => titles.has(f.projectId)).map((f) => ({ id: f.id, projectId: f.projectId, title: titles.get(f.projectId)!, finishedAt: f.updatedAt })) }, TAKE) });
}
