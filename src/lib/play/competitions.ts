import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "node:crypto";
import { gameSlugs } from "./engine";
import { z } from "zod";
export const tournamentInput = z
  .object({
    title: z.string().min(3).max(180),
    description: z.string().max(3000),
    gameSlug: z.enum(gameSlugs),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    maxAttempts: z.number().int().min(1).max(10),
    maxParticipants: z.number().int().min(1).max(10000),
    rewardTitle: z.string().max(180),
    terms: z.string().min(20).max(10000),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt));
type Rank = {
  userId: string;
  score: number;
  sessionId: string;
  completedAt: string;
};
export async function competitionCommand(actorId: string, input: unknown) {
  const c = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("create"), configuration: tournamentInput }),
      z.object({
        action: z.enum(["publish", "pause", "close", "archive", "approve"]),
        id: z.string().max(100),
      }),
      z.object({
        action: z.literal("fulfill"),
        id: z.string().max(100),
        note: z.string().min(5).max(1000),
      }),
    ])
    .parse(input);
  return prisma.$transaction(async (tx) => {
    let result: unknown;
    if (c.action === "create") {
      const v = c.configuration;
      if (v.gameSlug === "brain")
        throw Error("BRAIN_COMPETITION_REQUIRES_FIXED_BANK_VERSION");
      const game = await tx.playGame.findUniqueOrThrow({
        where: { slug: v.gameSlug },
      });
      result = await tx.playTournament.create({
        data: {
          ...v,
          configuration: game.configuration,
          configVersion: game.version,
          startsAt: new Date(v.startsAt),
          endsAt: new Date(v.endsAt),
          seed: randomBytes(4).readUInt32LE() & 0x7fffffff,
        },
      });
    } else if (c.action === "fulfill") {
      const grant = await tx.playRewardGrant.findUniqueOrThrow({
        where: { id: c.id },
      });
      if (grant.status !== "APPROVED") throw Error("REWARD_NOT_APPROVED");
      result = await tx.playRewardGrant.update({
        where: { id: c.id },
        data: {
          status: "FULFILLED",
          deliveryNote: c.note,
          fulfilledAt: new Date(),
        },
      });
      await tx.notification.create({
        data: {
          userId: grant.userId,
          type: "play_reward",
          title: "AIFekr PLAY · Reward delivered",
          body: grant.title,
          link: "/play",
        },
      });
    } else {
      const t = await tx.playTournament.findUniqueOrThrow({
        where: { id: c.id },
      });
      if (c.action === "publish") {
        if (!["DRAFT", "PAUSED"].includes(t.status) || t.endsAt <= new Date())
          throw Error("INVALID_TOURNAMENT_STATE");
        result = await tx.playTournament.update({
          where: { id: t.id },
          data: { status: "PUBLISHED" },
        });
      }
      if (c.action === "pause") {
        if (t.status !== "PUBLISHED") throw Error("INVALID_TOURNAMENT_STATE");
        result = await tx.playTournament.update({
          where: { id: t.id },
          data: { status: "PAUSED" },
        });
      }
      if (c.action === "archive") {
        if (!["DRAFT", "CLOSED", "APPROVED"].includes(t.status))
          throw Error("CLOSE_BEFORE_ARCHIVING");
        result = await tx.playTournament.update({
          where: { id: t.id },
          data: { status: "ARCHIVED" },
        });
      }
      if (c.action === "close") {
        if (
          !["PUBLISHED", "PAUSED"].includes(t.status) ||
          t.endsAt > new Date()
        )
          throw Error("COMPETITION_NOT_ENDED");
        const scores = await tx.playSession.findMany({
          where: {
            tournamentId: t.id,
            status: "ACCEPTED",
            completedAt: { lte: t.endsAt },
          },
          orderBy: [{ score: "desc" }, { completedAt: "asc" }, { id: "asc" }],
        });
        const seen = new Set<string>(),
          rankings: Rank[] = [];
        for (const s of scores)
          if (!seen.has(s.userId)) {
            seen.add(s.userId);
            rankings.push({
              userId: s.userId,
              score: s.score,
              sessionId: s.id,
              completedAt: s.completedAt!.toISOString(),
            });
          }
        result = await tx.playTournament.update({
          where: { id: t.id },
          data: { status: "CLOSED", results: JSON.stringify(rankings) },
        });
      }
      if (c.action === "approve") {
        if (t.status !== "CLOSED") throw Error("WINNERS_NOT_READY");
        const winner = (JSON.parse(t.results) as Rank[])[0];
        if (winner && t.rewardTitle) {
          const profile = await tx.playProfile.findUniqueOrThrow({
            where: { userId: winner.userId },
          });
          if (profile.suspended) throw Error("WINNER_REQUIRES_REVIEW");
          await tx.playRewardGrant.upsert({
            where: {
              tournamentId_userId: {
                tournamentId: t.id,
                userId: winner.userId,
              },
            },
            create: {
              tournamentId: t.id,
              userId: winner.userId,
              title: t.rewardTitle,
              approvedBy: actorId,
            },
            update: {},
          });
          await tx.notification.create({
            data: {
              userId: winner.userId,
              type: "play_reward",
              title: "AIFekr PLAY · Reward approved",
              body: t.rewardTitle,
              link: "/play",
            },
          });
        }
        result = await tx.playTournament.update({
          where: { id: t.id },
          data: { status: "APPROVED" },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: `play.competition.${c.action}`,
        metadata: JSON.stringify(c),
      },
    });
    return result;
  });
}
