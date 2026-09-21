import { prisma } from "@/lib/db/prisma";
import { runContentPipeline } from "@/lib/agents/runContentPipeline";
import { reserveToolCredits } from "@/lib/utils/toolCredits";
import { chooseTopic, effectiveMode, isMode, nextRunDate, parseTopics, STALE_RUN_MS, type PlanMode } from "@/lib/seo/contentPlanCore";
import type { Lang } from "@/lib/i18n/server";

export type PlanRunResult =
  | { ok: true; postId: string; runId: string; status: string; url: string | null }
  | { ok: false; reason: "already_running" | "no_topic" | "insufficient_credits" | "failed"; message?: string };

const DAY = 24 * 60 * 60 * 1000;
const langOf = (l: string): Lang => (l === "en" || l === "de" || l === "tr" ? l : "fa");

/**
 * Writes (and, per the plan's mode, publishes) the plan's next blog post.
 * Used by the scheduler and by "write one now". Safe against double starts, bills
 * the same credits as a manual pipeline run and refunds them if the chain fails.
 */
export interface RunOptions {
  /** Write about this specific topic now (does not consume the queue and leaves the schedule alone). */
  topic?: string;
  /** Override the plan's publish mode for this run only. */
  mode?: PlanMode;
}

export async function runContentPlan(planId: string, opts: RunOptions = {}): Promise<PlanRunResult> {
  const plan = await prisma.seoContentPlan.findUniqueOrThrow({ where: { id: planId } });

  // Claim the plan atomically: only one caller may hold it, and a marker left by a dead process expires.
  const claim = await prisma.seoContentPlan.updateMany({
    where: { id: plan.id, OR: [{ runningSince: null }, { runningSince: { lt: new Date(Date.now() - STALE_RUN_MS) } }] },
    data: { runningSince: new Date() },
  });
  if (claim.count === 0) return { ok: false, reason: "already_running" };

  const finish = (data: { nextRunAt?: Date | null; lastError?: string | null; lastRunAt?: Date; topics?: string }) =>
    prisma.seoContentPlan.update({ where: { id: plan.id }, data: { ...data, runningSince: null } });
  // A hand-started run must not move the schedule: only scheduled runs reschedule themselves.
  const manual = !!opts.topic;
  const retryAt = (ms: number) => (manual ? plan.nextRunAt : plan.enabled ? new Date(Date.now() + ms) : null);

  const choice = manual ? { topic: opts.topic!.trim().slice(0, 300), fromQueue: false, remaining: [] as string[] } : chooseTopic(parseTopics(plan.topics), plan.theme);
  if (!choice) {
    await finish({ lastError: "no_topic", nextRunAt: retryAt(DAY) });
    return { ok: false, reason: "no_topic" };
  }

  const gate = await reserveToolCredits(plan.userId, "seo.pipeline");
  if (!gate.ok) {
    await finish({ lastError: "insufficient_credits", nextRunAt: retryAt(DAY) });
    return { ok: false, reason: "insufficient_credits" };
  }

  const conn = await prisma.seoConnection.findUnique({ where: { userId: plan.userId } });
  const hasWordPress = !!(conn && conn.platform === "wordpress" && conn.siteUrl && conn.wpUsername && conn.wpAppPassword);
  const mode: PlanMode = effectiveMode(opts.mode && isMode(opts.mode) ? opts.mode : isMode(plan.mode) ? plan.mode : "draft", hasWordPress);

  const recent = await prisma.contentPost.findMany({ where: { userId: plan.userId }, orderBy: { publishedAt: "desc" }, take: 30, select: { title: true } });

  const run = await prisma.contentPipelineRun.create({
    data: { userId: plan.userId, topic: choice.topic, brandVoice: plan.brandVoice, status: "running", planId: plan.id },
  });

  try {
    const { postId, publishResult } = await runContentPipeline({
      userId: plan.userId, runId: run.id, topic: choice.topic, brandVoice: plan.brandVoice ?? undefined,
      lang: langOf(plan.lang), publishMode: mode, avoidTitles: recent.map((p) => p.title),
    });
    const now = new Date();
    await finish({
      lastRunAt: now, lastError: publishResult.status === "failed" ? `publish_failed: ${publishResult.error ?? ""}`.slice(0, 300) : null,
      nextRunAt: manual ? plan.nextRunAt : plan.enabled ? nextRunDate(plan.frequency, now) : null,
      ...(choice.fromQueue ? { topics: JSON.stringify(choice.remaining) } : {}),
    });
    return { ok: true, postId, runId: run.id, status: publishResult.status, url: publishResult.url };
  } catch (e) {
    await gate.release();
    await prisma.contentPipelineRun.update({ where: { id: run.id }, data: { status: "failed" } }).catch(() => {});
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await finish({ lastError: message, nextRunAt: retryAt(6 * 60 * 60 * 1000) });
    return { ok: false, reason: "failed", message };
  }
}
