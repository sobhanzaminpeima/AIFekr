export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { playSettingsKey } from "@/lib/play/service";
import { gameSlugs } from "@/lib/play/engine";
import { z } from "zod";
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("lifecycle"),
    status: z.enum([
      "INSTALLED",
      "ENABLED",
      "DISABLED",
      "MAINTENANCE",
      "ARCHIVED",
    ]),
  }),
  z.object({
    action: z.literal("game"),
    slug: z.enum(gameSlugs),
    status: z.enum(["ENABLED", "DISABLED", "MAINTENANCE", "ARCHIVED"]),
    rules: z
      .object({
        speedScale: z.number().min(0.5).max(2),
        pointScale: z.number().int().min(1).max(3),
      })
      .optional(),
  }),
  z.object({
    action: z.literal("moderate"),
    userId: z.string().max(100),
    suspended: z.boolean(),
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    action: z.literal("question"),
    id: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    language: z.enum(["fa", "en", "de", "tr"]),
    prompt: z.string().min(10).max(2000),
    options: z.array(z.string().min(1).max(300)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().min(5).max(2000),
  }),
]);
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse(req);
  const [config, games, players, sessions, questions] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: playSettingsKey } }),
    prisma.playGame.findMany(),
    prisma.playProfile.findMany({
      orderBy: { lastActivity: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.playSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        userId: true,
        gameSlug: true,
        status: true,
        score: true,
        xp: true,
        rejectionReason: true,
        createdAt: true,
      },
    }),
    prisma.playQuestion.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({
    configuration: config ? JSON.parse(config.value) : { status: "DISABLED" },
    games,
    players,
    sessions,
    questions,
    totals: {
      players: await prisma.playProfile.count(),
      sessions: await prisma.playSession.count(),
      verified: await prisma.playSession.count({
        where: { status: "ACCEPTED" },
      }),
    },
  });
}
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const c = command.parse(await req.json());
    await prisma.$transaction(async (tx) => {
      if (c.action === "lifecycle")
        await tx.siteSetting.upsert({
          where: { key: playSettingsKey },
          create: {
            key: playSettingsKey,
            value: JSON.stringify({ status: c.status, version: 1 }),
          },
          update: { value: JSON.stringify({ status: c.status, version: 1 }) },
        });
      if (c.action === "game")
        await tx.playGame.update({
          where: { slug: c.slug },
          data: {
            status: c.status,
            version: { increment: 1 },
            ...(c.rules
              ? {
                  configuration: JSON.stringify({
                    engineVersion: 1,
                    frameMs: 50,
                    maxFrames: 12000,
                    ...c.rules,
                  }),
                }
              : {}),
          },
        });
      if (c.action === "moderate")
        await tx.playProfile.update({
          where: { userId: c.userId },
          data: { suspended: c.suspended, moderationReason: c.reason },
        });
      if (c.action === "question") {
        const { createHash } = await import("node:crypto"),
          data = {
            language: c.language,
            prompt: c.prompt,
            options: JSON.stringify(c.options),
            answer: c.answer,
            explanation: c.explanation,
            status: c.status,
            fingerprint: createHash("sha256")
              .update(c.language + ":" + c.prompt.trim().toLowerCase())
              .digest("hex"),
          };
        if (c.id) await tx.playQuestion.update({ where: { id: c.id }, data });
        else await tx.playQuestion.create({ data });
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: `play.${c.action}`,
          metadata: JSON.stringify(c),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "INVALID_PLAY_COMMAND" },
      { status: 400 },
    );
  }
}
