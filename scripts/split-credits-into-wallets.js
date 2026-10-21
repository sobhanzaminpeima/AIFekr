// Phase 2 one-time backfill: splits each user's existing single `credits`
// balance into the three new wallets (aiCredits / mediaCredits /
// voiceMinutes), proportionally to that user's REAL historical usage mix
// from UsageLog -- this is the user's explicit decision (not an even split,
// not "everything goes to AI credits"). Users with no usage history at all
// (new signups, never used a paid feature) get their whole balance parked
// in aiCredits, since chat is the first thing anyone tries.
//
// Safe to re-run: it always recomputes from the current `credits` value and
// UsageLog history, so running it twice just re-derives the same split
// unless credits or usage history changed in between. Intended to run
// exactly once, immediately after the 20260917_wallet_split migration.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const AI_TYPES = new Set(["chat"]);
const MEDIA_TYPES = new Set(["image", "video", "music"]);
const VOICE_TYPES = new Set(["voice"]);

async function splitOne(id, credits, kind) {
  const usage = await prisma.usageLog.groupBy({
    by: ["type"],
    where: kind === "team" ? { user: { teamMembership: { teamId: id } } } : { userId: id },
    _sum: { credits: true },
  });

  let aiSpent = 0, mediaSpent = 0, voiceSpent = 0;
  for (const row of usage) {
    const spent = row._sum.credits || 0;
    if (AI_TYPES.has(row.type)) aiSpent += spent;
    else if (MEDIA_TYPES.has(row.type)) mediaSpent += spent;
    else if (VOICE_TYPES.has(row.type)) voiceSpent += spent;
    else aiSpent += spent; // unknown type -- default to AI bucket rather than dropping it
  }

  const totalSpent = aiSpent + mediaSpent + voiceSpent;
  let aiShare, mediaShare, voiceShare;
  if (totalSpent === 0) {
    aiShare = 1; mediaShare = 0; voiceShare = 0;
  } else {
    aiShare = aiSpent / totalSpent;
    mediaShare = mediaSpent / totalSpent;
    voiceShare = voiceSpent / totalSpent;
  }

  return {
    aiCredits: credits * aiShare,
    mediaCredits: credits * mediaShare,
    voiceMinutes: credits * voiceShare,
  };
}

(async () => {
  const users = await prisma.user.findMany({ select: { id: true, credits: true } });
  for (const u of users) {
    const wallets = await splitOne(u.id, u.credits, "user");
    await prisma.user.update({ where: { id: u.id }, data: wallets });
    console.log(`user ${u.id}: credits=${u.credits} -> ai=${wallets.aiCredits.toFixed(1)} media=${wallets.mediaCredits.toFixed(1)} voice=${wallets.voiceMinutes.toFixed(1)}`);
  }

  const teams = await prisma.team.findMany({ select: { id: true, credits: true } });
  for (const t of teams) {
    const usage = await prisma.usageLog.groupBy({
      by: ["type"],
      where: { user: { teamMembership: { teamId: t.id } } },
      _sum: { credits: true },
    });
    let aiSpent = 0, mediaSpent = 0, voiceSpent = 0;
    for (const row of usage) {
      const spent = row._sum.credits || 0;
      if (AI_TYPES.has(row.type)) aiSpent += spent;
      else if (MEDIA_TYPES.has(row.type)) mediaSpent += spent;
      else if (VOICE_TYPES.has(row.type)) voiceSpent += spent;
      else aiSpent += spent;
    }
    const totalSpent = aiSpent + mediaSpent + voiceSpent;
    const aiShare = totalSpent === 0 ? 1 : aiSpent / totalSpent;
    const mediaShare = totalSpent === 0 ? 0 : mediaSpent / totalSpent;
    const voiceShare = totalSpent === 0 ? 0 : voiceSpent / totalSpent;
    const wallets = {
      aiCredits: t.credits * aiShare,
      mediaCredits: t.credits * mediaShare,
      voiceMinutes: t.credits * voiceShare,
    };
    await prisma.team.update({ where: { id: t.id }, data: wallets });
    console.log(`team ${t.id}: credits=${t.credits} -> ai=${wallets.aiCredits.toFixed(1)} media=${wallets.mediaCredits.toFixed(1)} voice=${wallets.voiceMinutes.toFixed(1)}`);
  }

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
