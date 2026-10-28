import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { growthFlag } from "@/lib/growth/config";
import { trackEvent } from "@/lib/growth/events";
import { GROWTH_MODULES, INTENTS, OBJECTIVES, PERSONAS, growthModule, recommendModule } from "@/lib/growth/modules";
import { BLOCKING_MODULE_STATUSES } from "@/lib/modules/moduleRoutes";

/** Modules an admin has not disabled; onboarding never recommends an unavailable module. */
async function availableModules() {
  const blocked = new Set((await prisma.moduleRegistry.findMany({ where: { status: { in: [...BLOCKING_MODULE_STATUSES] } }, select: { key: true } })).map(m => m.key));
  return GROWTH_MODULES.filter(m => !m.registryKey || !blocked.has(m.registryKey));
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!(await growthFlag("smart_onboarding_enabled"))) return NextResponse.json({ enabled: false });
  const modules = await availableModules();
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id } });
  const recommended = recommendModule(profile?.objective, m => modules.includes(m));
  return NextResponse.json({
    enabled: true, credits: user.credits, accountType: user.accountType,
    state: profile?.onboardingState ?? "not_started", step: profile?.onboardingStep ?? 0,
    answers: { objective: profile?.objective ?? null, persona: profile?.persona ?? null, intent: profile?.intent ?? null },
    options: { objectives: OBJECTIVES.filter(o => modules.some(m => m.objectives.includes(o.id))), personas: PERSONAS, intents: INTENTS },
    recommendation: recommended && { id: recommended.id, name: recommended.name, path: recommended.paths[0], firstValue: recommended.firstValue, exampleTask: recommended.exampleTask },
  });
}

const body = z.object({
  action: z.enum(["save", "skip", "complete"]),
  step: z.number().int().min(0).max(4).optional(),
  objective: z.string().max(40).nullable().optional(),
  persona: z.string().max(40).nullable().optional(),
  intent: z.string().max(40).nullable().optional(),
});

/** Saves answers (resume later), skips, or completes. Completing is not "first value" -- that comes only from a real result. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const { action, step, objective, persona, intent } = parsed.data;
  const pick = <T extends { id: string }>(list: T[], v: string | null | undefined) => v === undefined ? undefined : list.some(x => x.id === v) ? v : null;
  const answers = { objective: pick(OBJECTIVES, objective), persona: pick(PERSONAS, persona), intent: pick(INTENTS, intent) };
  const prev = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { onboardingState: true } });
  const state = action === "skip" ? "skipped" : action === "complete" ? "completed" : "in_progress";
  await prisma.growthProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onboardingState: state, onboardingStep: step ?? 0, ...answers, onboardingCompletedAt: action === "complete" ? new Date() : null },
    update: { onboardingState: state, ...(step !== undefined ? { onboardingStep: step } : {}), ...answers, ...(action === "complete" ? { onboardingCompletedAt: new Date() } : {}) },
  });
  if (!prev || prev.onboardingState === "not_started") await trackEvent({ name: "onboarding_started", userId: user.id, idempotencyKey: `onb:start:${user.id}` });
  if (action === "save" && step !== undefined) await trackEvent({ name: "onboarding_step_completed", userId: user.id, metadata: { step, objective: answers.objective ?? null }, idempotencyKey: `onb:step:${user.id}:${step}` });
  if (action !== "save") {
    await prisma.user.update({ where: { id: user.id }, data: { onboardingDone: true } });
    await trackEvent({ name: action === "skip" ? "onboarding_skipped" : "onboarding_completed", userId: user.id, idempotencyKey: `onb:${action}:${user.id}` });
  }
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { objective: true } });
  const modules = await availableModules();
  const rec = recommendModule(profile?.objective, m => modules.includes(m));
  return NextResponse.json({ ok: true, redirect: action === "skip" ? "/home" : action === "complete" ? growthModule(rec?.id)?.paths[0] ?? "/home" : null });
}
