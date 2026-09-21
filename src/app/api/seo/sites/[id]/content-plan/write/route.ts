export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { runContentPlan } from "@/lib/seo/contentPlanService";
import { isMode } from "@/lib/seo/contentPlanCore";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { STALE_RUN_MS } from "@/lib/seo/contentPlanCore";

/**
 * "Write an article about X" -- an explicit topic, written now with the 8-agent content
 * team and sent to WordPress as a draft or live post (or kept in AiFekr). Runs in the
 * background (it takes minutes); the plan card polls for the result. Works even if
 * automation is switched off: it only creates the plan record as a disabled holder.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id }, include: { contentPlan: true } });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const topic = typeof b.topic === "string" ? b.topic.replace(/\s+/g, " ").trim() : "";
  if (topic.length < 5) return NextResponse.json({ error: tri(lang, "موضوع مقاله را بنویسید (حداقل ۵ حرف).", "Enter the article topic (at least 5 characters).", "Geben Sie das Artikelthema ein (mindestens 5 Zeichen).") }, { status: 400 });
  if (topic.length > 300) return NextResponse.json({ error: tri(lang, "موضوع خیلی بلند است (حداکثر ۳۰۰ حرف).", "The topic is too long (300 characters max).", "Das Thema ist zu lang (max. 300 Zeichen).") }, { status: 400 });
  const mode = isMode(b.mode) ? b.mode : undefined;

  const plan = site.contentPlan ?? await prisma.seoContentPlan.create({ data: { siteId: site.id, userId: user.id, enabled: false, lang } });
  if (plan.runningSince && Date.now() - plan.runningSince.getTime() < STALE_RUN_MS) {
    return NextResponse.json({ error: tri(lang, "همین حالا یک مقاله در حال نوشتن است.", "An article is already being written.", "Es wird bereits ein Artikel geschrieben."), code: "RUNNING" }, { status: 409 });
  }
  await prisma.seoContentPlan.update({ where: { id: plan.id }, data: { lang } });

  void runContentPlan(plan.id, { topic, mode }).catch((e) => console.error("write-now run crashed:", e));
  return NextResponse.json({ started: true }, { status: 202 });
}
