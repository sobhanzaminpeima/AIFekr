import { prisma } from "@/lib/db/prisma";
import { getReferralCommissionPercent } from "@/lib/utils/referralWallet";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Data for the new design's home dashboard: the account's latest creations,
 * its credit use (UsageLog, the same ledger as /api/user/usage/history) and
 * its real referral commission. Only the caller's own data.
 */
export async function dashboardData(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 14 * DAY);
  const media = { where: { userId, url: { not: "" } }, orderBy: { createdAt: "desc" as const }, take: 3, select: { id: true, prompt: true, url: true, createdAt: true } };
  const [user, images, videos, music, usage, commissionPercent] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.generatedImage.findMany(media),
    prisma.generatedVideo.findMany({ ...media, where: { ...media.where, refunded: false } }),
    prisma.generatedMusic.findMany({ ...media, where: { ...media.where, refunded: false } }),
    prisma.usageLog.findMany({ where: { userId, createdAt: { gte: since } }, select: { credits: true, createdAt: true } }),
    getReferralCommissionPercent(userId),
  ]);
  const recent = [
    ...images.map((m) => ({ ...m, type: "image" as const })),
    ...videos.map((m) => ({ ...m, type: "video" as const })),
    ...music.map((m) => ({ ...m, type: "music" as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3)
    .map((m) => ({ id: m.id, type: m.type, prompt: m.prompt.slice(0, 120), url: m.url, createdAt: m.createdAt.toISOString() }));
  // Seven rolling days, oldest first, plus the seven before them for the trend.
  const days = Array.from({ length: 14 }, () => 0);
  for (const row of usage) {
    const age = Math.floor((now.getTime() - row.createdAt.getTime()) / DAY);
    if (age >= 0 && age < 14) days[13 - age] += Math.max(0, row.credits);
  }
  const thisWeek = days.slice(7).reduce((a, b) => a + b, 0), lastWeek = days.slice(0, 7).reduce((a, b) => a + b, 0);
  return {
    firstName: (user?.name || "").trim().split(/\s+/)[0] || null,
    recent,
    usage: { days: days.slice(7), thisWeek, lastWeek },
    commissionPercent,
  };
}
