import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { growthFlag } from "@/lib/growth/config";
import { trackEvent } from "@/lib/growth/events";
import { INTENTS, OBJECTIVES, PERSONAS, moduleEntry, parseGoals, recommendModules } from "@/lib/growth/modules";
import { INVITE_DISMISSED, availableModules, onboardingView } from "@/lib/growth/onboarding";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!(await growthFlag("smart_onboarding_enabled"))) return NextResponse.json({ enabled: false });
  return NextResponse.json(await onboardingView(user));
}

const body = z.object({
  action: z.enum(["save", "skip", "complete", "dismiss_invite"]),
  step: z.number().int().min(0).max(4).optional(),
  /** Several goals, primary first. The classic wizard sends a single `objective` instead. */
  goals: z.array(z.string().max(40)).max(OBJECTIVES.length).optional(),
  objective: z.string().max(40).nullable().optional(),
  persona: z.string().max(40).nullable().optional(),
  intent: z.string().max(40).nullable().optional(),
  /** On complete: the recommended module the user chose to start with. */
  module: z.string().max(40).optional(),
});

/**
 * Saves answers (resume or edit later), skips, completes, or declines the home
 * invitation. Completing is not "first value" -- that comes only from a real result.
 * Answers only order what is shown; they never grant or remove access.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const { action, step, goals, objective, persona, intent, module } = parsed.data;
  if (action === "dismiss_invite") {
    await trackEvent({ name: INVITE_DISMISSED, userId: user.id, idempotencyKey: `onb:invite_dismissed:${user.id}` });
    return NextResponse.json({ ok: true, redirect: null });
  }
  const pick = <T extends { id: string }>(list: T[], v: string | null | undefined) => v === undefined ? undefined : list.some(x => x.id === v) ? v : null;
  const goalList = goals !== undefined ? parseGoals(goals.join(",")) : objective !== undefined ? parseGoals(objective ?? "") : undefined;
  const answers = {
    ...(goalList !== undefined ? { goals: goalList.join(","), objective: goalList[0] ?? null } : {}),
    persona: pick(PERSONAS, persona), intent: pick(INTENTS, intent),
  };
  const prev = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { onboardingState: true } });
  // Editing later never turns a finished onboarding back into an unfinished one.
  const state = prev?.onboardingState === "completed" ? "completed" : action === "skip" ? "skipped" : action === "complete" ? "completed" : "in_progress";
  await prisma.growthProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onboardingState: state, onboardingStep: step ?? 0, ...answers, onboardingCompletedAt: action === "complete" ? new Date() : null },
    update: { onboardingState: state, ...(step !== undefined ? { onboardingStep: step } : {}), ...answers, ...(action === "complete" && prev?.onboardingState !== "completed" ? { onboardingCompletedAt: new Date() } : {}) },
  });
  if (!prev || prev.onboardingState === "not_started") await trackEvent({ name: "onboarding_started", userId: user.id, idempotencyKey: `onb:start:${user.id}` });
  if (action === "save" && step !== undefined) await trackEvent({ name: "onboarding_step_completed", userId: user.id, metadata: { step, objective: answers.objective ?? null, goals: goalList?.length ?? null }, idempotencyKey: `onb:step:${user.id}:${step}` });
  if (action !== "save") await prisma.user.update({ where: { id: user.id }, data: { onboardingDone: true } });
  // Leaving an edit of a finished onboarding is not a skip.
  if (action !== "save" && prev?.onboardingState !== "completed") {
    await trackEvent({ name: action === "skip" ? "onboarding_skipped" : "onboarding_completed", userId: user.id, idempotencyKey: `onb:${action}:${user.id}` });
  }
  if (action !== "complete") return NextResponse.json({ ok: true, redirect: action === "skip" ? "/home" : null });
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { goals: true, objective: true } });
  const modules = await availableModules();
  const recs = recommendModules(parseGoals(profile?.goals || profile?.objective), m => modules.includes(m));
  // Only a module that is available may be the destination; anything else goes to the first suggestion.
  const chosen = recs.find(m => m.id === module) ?? modules.find(m => m.id === module) ?? recs[0];
  return NextResponse.json({ ok: true, redirect: (chosen ? moduleEntry(chosen) : "/home") });
}
