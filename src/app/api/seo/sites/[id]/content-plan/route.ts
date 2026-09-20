export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";
import { isFrequency, isMode, parseTopics, sanitizeTopics } from "@/lib/seo/contentPlanCore";

const DEFAULTS = { enabled: false, theme: "", topics: [] as string[], brandVoice: "", frequency: "weekly", mode: "draft" };

async function ownedSite(userId: string, id: string) {
  return prisma.seoSite.findFirst({ where: { id, userId }, include: { contentPlan: true } });
}

/** The site's blog-automation plan (defaults when none is saved yet), whether WordPress is connected, and the posts it produced. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const site = await ownedSite(user.id, params.id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conn = await prisma.seoConnection.findUnique({ where: { userId: user.id }, select: { platform: true, siteUrl: true, wpUsername: true, wpAppPassword: true } });
  const wordpressConnected = !!(conn && conn.platform === "wordpress" && conn.siteUrl && conn.wpUsername && conn.wpAppPassword);

  const p = site.contentPlan;
  const runs = p
    ? await prisma.contentPipelineRun.findMany({
        where: { planId: p.id }, orderBy: { createdAt: "desc" }, take: 15,
        select: { id: true, topic: true, status: true, createdAt: true, post: { select: { id: true, title: true, externalStatus: true, externalUrl: true, externalError: true } } },
      })
    : [];

  return NextResponse.json({
    plan: p
      ? { enabled: p.enabled, theme: p.theme, topics: parseTopics(p.topics), brandVoice: p.brandVoice ?? "", frequency: p.frequency, mode: p.mode, nextRunAt: p.nextRunAt, lastRunAt: p.lastRunAt, lastError: p.lastError, running: !!p.runningSince }
      : { ...DEFAULTS, nextRunAt: null, lastRunAt: null, lastError: null, running: false },
    wordpressConnected,
    runs,
  });
}

/** Saves the plan. Turning it on schedules the first post for the next scheduler tick. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const site = await ownedSite(user.id, params.id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lang = await getServerLang();

  const b = await req.json().catch(() => ({}));
  const enabled = typeof b.enabled === "boolean" ? b.enabled : site.contentPlan?.enabled ?? false;
  const theme = typeof b.theme === "string" ? b.theme.trim().slice(0, 300) : site.contentPlan?.theme ?? "";
  const topics = b.topics !== undefined ? sanitizeTopics(b.topics) : parseTopics(site.contentPlan?.topics);
  const brandVoice = typeof b.brandVoice === "string" ? b.brandVoice.trim().slice(0, 1500) : site.contentPlan?.brandVoice ?? "";
  const frequency = isFrequency(b.frequency) ? b.frequency : site.contentPlan?.frequency ?? "weekly";
  const mode = isMode(b.mode) ? b.mode : site.contentPlan?.mode ?? "draft";

  const wasEnabled = site.contentPlan?.enabled ?? false;
  const data = {
    enabled, theme, topics: JSON.stringify(topics), brandVoice: brandVoice || null, frequency, mode, lang,
    // First activation: run at the next tick. Deactivation: no schedule. Otherwise leave the running schedule alone.
    ...(enabled && !wasEnabled ? { nextRunAt: new Date() } : {}),
    ...(!enabled ? { nextRunAt: null } : {}),
  };

  if (enabled && !topics.length && !theme) {
    return NextResponse.json({ error: lang === "fa" ? "برای فعال‌سازی، حداقل یک موضوع یا یک تم کلی بنویسید." : lang === "de" ? "Zum Aktivieren geben Sie mindestens ein Thema oder ein Oberthema an." : "To turn it on, add at least one topic or a general theme." }, { status: 400 });
  }

  await prisma.seoContentPlan.upsert({ where: { siteId: site.id }, create: { siteId: site.id, userId: user.id, ...data }, update: data });
  return NextResponse.json({ ok: true });
}
