import { prisma } from "@/lib/db/prisma";
import { playAccess, xpForScore } from "./service";
type Question = {
  id: string;
  prompt: string;
  options: string;
  answer: number;
  explanation: string;
};
export async function brainAction(
  userId: string,
  id: string,
  index?: number,
  answer?: number,
) {
  await playAccess(userId);
  return prisma.$transaction(async (tx) => {
    const s = await tx.playSession.findFirst({
      where: { id, userId, gameSlug: "brain" },
    });
    if (!s || s.status !== "OPEN" || s.expiresAt < new Date())
      throw Error("SESSION_EXPIRED");
    const questions = JSON.parse(s.questions) as Question[];
    let feedback: unknown = null;
    if (index !== undefined) {
      if (
        index !== s.answered ||
        answer === undefined ||
        answer < 0 ||
        answer > 3
      )
        throw Error("ANSWER_CONFLICT");
      const q = questions[index],
        elapsed = Date.now() - s.questionAt.getTime(),
        correct = q.answer === answer && elapsed <= 30000,
        score = correct
          ? 100 + Math.max(0, 30 - Math.floor(elapsed / 1000))
          : 0,
        done = index + 1 === questions.length;
      const changed = await tx.playSession.updateMany({
        where: { id, answered: index, status: "OPEN" },
        data: {
          answered: { increment: 1 },
          score: { increment: score },
          questionAt: new Date(),
          ...(done
            ? {
                status: "ACCEPTED",
                completedAt: new Date(),
                xp: xpForScore(s.score + score),
              }
            : {}),
        },
      });
      if (!changed.count) throw Error("ANSWER_CONFLICT");
      feedback = { correct, answer: q.answer, explanation: q.explanation };
      if (done) {
        const xp = xpForScore(s.score + score);
        await tx.playXpEntry.create({
          data: { userId, sessionId: id, amount: xp },
        });
        await tx.playProfile.update({
          where: { userId },
          data: {
            xp: { increment: xp },
            points: { increment: s.score + score },
            sessions: { increment: 1 },
            lastActivity: new Date(),
          },
        });
        await tx.playAchievementGrant.upsert({
          where: { userId_code: { userId, code: "FIRST_GAME" } },
          create: { userId, code: "FIRST_GAME" },
          update: {},
        });
        return { done: true, score: s.score + score, xp, feedback };
      }
    }
    const current = questions[index === undefined ? s.answered : index + 1];
    return {
      question: {
        index: index === undefined ? s.answered : index + 1,
        prompt: current.prompt,
        options: JSON.parse(current.options),
      },
      feedback,
      total: questions.length,
      deadline: new Date((index===undefined?s.questionAt.getTime():Date.now()) + 30000).toISOString(),
    };
  });
}
