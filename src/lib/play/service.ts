import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  gameSlugs,
  validateReplay,
  type GameSlug,
  type ReplayEvent,
} from "./engine";
export const playSettingsKey = "aifekrPlay";
export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
export function xpForScore(score: number) {
  return Math.min(100, Math.floor(Math.max(0, score) / 10));
}
export async function playAccess(userId: string) {
  const [setting, profile] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: playSettingsKey } }),
    prisma.playProfile.findUnique({ where: { userId } }),
  ]);
  const config = setting ? JSON.parse(setting.value) : { status: "DISABLED" };
  if (config.status !== "ENABLED") throw Error("PLAY_UNAVAILABLE");
  if (profile?.suspended) throw Error("PLAY_SUSPENDED");
  return config;
}
export async function startSession(
  userId: string,
  gameSlug: GameSlug,
  language: string,
  tournamentId?: string,
) {
  await playAccess(userId);
  const game = await prisma.playGame.findUnique({ where: { slug: gameSlug } });
  if (!game || game.status !== "ENABLED" || !gameSlugs.includes(gameSlug))
    throw Error("GAME_UNAVAILABLE");
  let seed = randomBytes(4).readUInt32LE() & 0x7fffffff;
  const questions =
    gameSlug === "brain"
      ? await prisma.playQuestion.findMany({
          where: { language, status: "PUBLISHED" },
          take: 100,
          select: {
            id: true,
            prompt: true,
            options: true,
            answer: true,
            explanation: true,
          },
        })
      : [];
  if (gameSlug === "brain" && questions.length < 5)
    throw Error("QUESTION_BANK_NOT_READY");
  return prisma.$transaction(async (tx) => {
    await tx.playProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    if (
      (await tx.playSession.count({
        where: { userId, status: "OPEN", expiresAt: { gt: new Date() } },
      })) >= 3
    )
      throw Error("TOO_MANY_OPEN_SESSIONS");
    let expiresAt = new Date(Date.now() + 20 * 60000);
    let configuration = game.configuration,
      configVersion = game.version;
    if (tournamentId) {
      await tx.playTournament.update({
        where: { id: tournamentId },
        data: { id: tournamentId },
      });
      const t = await tx.playTournament.findUniqueOrThrow({
        where: { id: tournamentId },
      });
      if (
        t.status !== "PUBLISHED" ||
        t.gameSlug !== gameSlug ||
        t.startsAt > new Date() ||
        t.endsAt <= new Date() ||
        gameSlug === "brain"
      )
        throw Error("COMPETITION_UNAVAILABLE");
      if (
        (await tx.playSession.count({ where: { userId, tournamentId } })) >=
        t.maxAttempts
      )
        throw Error("ATTEMPT_LIMIT");
      const entry = await tx.playTournamentEntry.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
      });
      if (!entry) {
        if (
          (await tx.playTournamentEntry.count({ where: { tournamentId } })) >=
          t.maxParticipants
        )
          throw Error("COMPETITION_FULL");
        await tx.playTournamentEntry.create({ data: { tournamentId, userId } });
      }
      seed = t.seed;
      configuration = t.configuration;
      configVersion = t.configVersion;
      expiresAt = new Date(Math.min(expiresAt.getTime(), t.endsAt.getTime()));
    }
    const chosen = questions
      .sort((a, b) =>
        createHash("sha256")
          .update(seed + a.id)
          .digest("hex")
          .localeCompare(
            createHash("sha256")
              .update(seed + b.id)
              .digest("hex"),
          ),
      )
      .slice(0, 5);
    return tx.playSession.create({
      data: {
        userId,
        gameSlug,
        tournamentId,
        configVersion,
        configuration,
        seed,
        expiresAt,
        questions: JSON.stringify(chosen),
      },
    });
  });
}
export async function finishSession(
  userId: string,
  id: string,
  events: ReplayEvent[],
  frames: number,
) {
  await playAccess(userId);
  const session = await prisma.playSession.findFirst({ where: { id, userId } });
  if (!session) throw Error("SESSION_NOT_FOUND");
  const evidenceHash = createHash("sha256")
    .update(JSON.stringify({ events, frames }))
    .digest("hex");
  if (session.status === "ACCEPTED") {
    if (session.evidenceHash !== evidenceHash) throw Error("RESULT_CONFLICT");
    return session;
  }
  if (session.status !== "OPEN" || session.expiresAt < new Date())
    throw Error("SESSION_EXPIRED");
  if (session.gameSlug === "brain") throw Error("BRAIN_ANSWER_REQUIRED");
  if (frames * 50 > Date.now() - session.createdAt.getTime() + 1500)
    throw Error("REPLAY_TOO_FAST");
  const state = validateReplay(
      session.gameSlug as GameSlug,
      session.seed,
      events,
      frames,
      JSON.parse(session.configuration),
    ),
    xp = xpForScore(state.score);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.playSession.updateMany({
      where: { id, userId, status: "OPEN" },
      data: {
        status: "ACCEPTED",
        score: state.score,
        xp,
        frames,
        replay: JSON.stringify(events),
        evidenceHash,
        completedAt: new Date(),
      },
    });
    if (!changed.count) throw Error("RESULT_ALREADY_SUBMITTED");
    await tx.playXpEntry.create({
      data: { userId, sessionId: id, amount: xp },
    });
    const profile = await tx.playProfile.update({
      where: { userId },
      data: {
        xp: { increment: xp },
        points: { increment: state.score },
        sessions: { increment: 1 },
        lastActivity: new Date(),
      },
    });
    for (const [code, unlock] of [
      ["FIRST_GAME", true],
      ["TEN_GAMES", profile.sessions >= 10],
      ["HUNDRED_GAMES", profile.sessions >= 100],
      ["FIRST_WIN", state.won],
    ] as const)
      if (unlock)
        await tx.playAchievementGrant.upsert({
          where: { userId_code: { userId, code } },
          create: { userId, code },
          update: {},
        });
    return tx.playSession.findUniqueOrThrow({ where: { id } });
  });
}
export async function playOverview(userId: string) {
  await playAccess(userId);
  const [profile, games, history, rankings, achievements, bests, user] =
    await Promise.all([
      prisma.playProfile.findUnique({ where: { userId } }),
      prisma.playGame.findMany({ orderBy: { slug: "asc" } }),
      prisma.playSession.findMany({
        where: { userId, status: "ACCEPTED" },
        orderBy: { completedAt: "desc" },
        take: 20,
        select: {
          id: true,
          gameSlug: true,
          score: true,
          xp: true,
          completedAt: true,
        },
      }),
      prisma.playProfile.findMany({
        where: { suspended: false },
        orderBy: [{ points: "desc" }, { userId: "asc" }],
        take: 100,
        select: {
          userId: true,
          publicName: true,
          points: true,
          xp: true,
          user: { select: { name: true } },
        },
      }),
      prisma.playAchievementGrant.findMany({ where: { userId } }),
      prisma.playSession.groupBy({
        by: ["gameSlug"],
        where: { userId, status: "ACCEPTED" },
        _max: { score: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
  return {
    user,
    personalBests: Object.fromEntries(
      bests.map((b) => [b.gameSlug, b._max.score ?? 0]),
    ),
    profile: profile
      ? {
          xp: profile.xp,
          points: profile.points,
          sessions: profile.sessions,
          publicName: profile.publicName,
          level: levelForXp(profile.xp),
        }
      : null,
    games,
    history,
    achievements,
    rankings: rankings.map((p, i) => ({
      rank: i + 1,
      name: p.publicName ? p.user.name || "Player" : `Player ${i + 1}`,
      mine: p.userId === userId,
      points: p.points,
      level: levelForXp(p.xp),
    })),
  };
}
