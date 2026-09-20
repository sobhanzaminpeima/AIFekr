export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { runContentPlan } from "@/lib/seo/contentPlanService";
import { parseTopics, chooseTopic } from "@/lib/seo/contentPlanCore";

/**
 * "Write one now". Writing a post takes minutes (eight model calls), so this starts
 * it in the background and returns at once; the page polls the plan for the result
 * (posts list, lastError). Credits are checked and billed inside the run.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const site = await prisma.seoSite.findFirst({ where: { id: params.id, userId: user.id }, include: { contentPlan: true } });
  const plan = site?.contentPlan;
  if (!site || !plan) return NextResponse.json({ error: "Save the plan first" }, { status: 400 });
  if (!chooseTopic(parseTopics(plan.topics), plan.theme)) return NextResponse.json({ error: "Add a topic or a theme first", code: "NO_TOPIC" }, { status: 400 });
  if (plan.runningSince && Date.now() - plan.runningSince.getTime() < 20 * 60 * 1000) return NextResponse.json({ error: "A post is already being written", code: "RUNNING" }, { status: 409 });

  void runContentPlan(plan.id).catch((e) => console.error("content plan run crashed:", e));
  return NextResponse.json({ started: true }, { status: 202 });
}
