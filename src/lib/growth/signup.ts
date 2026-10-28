import { prisma } from "@/lib/db/prisma";
import { growthFlag } from "./config";
import { moduleForPath, safeInternalPath } from "./attribution";
import { linkSignup, trackEvent } from "./events";

/**
 * marketingConsent gates email. `stopAll` (the unsubscribe link) also stops in-app
 * lifecycle messages; opting in again clears it.
 */
export async function setMarketingConsent(userId: string, consent: boolean, source: string, opts: { stopAll?: boolean } = {}) {
  const now = new Date();
  const unsubscribedAt = consent ? null : opts.stopAll ? now : undefined;
  await prisma.growthProfile.upsert({
    where: { userId },
    create: { userId, marketingConsent: consent, consentAt: now, consentSource: source, unsubscribedAt: unsubscribedAt ?? null },
    update: { marketingConsent: consent, consentAt: now, consentSource: source, ...(unsubscribedAt !== undefined ? { unsubscribedAt } : {}) },
  });
  await trackEvent({ name: consent ? "consent_granted" : "consent_revoked", userId, metadata: { source } });
}

/**
 * Runs after a new account is created. Returns the module page to send the
 * user to when they signed up from a module campaign (contextual onboarding
 * replaces the general /welcome wizard), or null to keep the existing flow.
 * A plan picked during signup keeps its checkout flow.
 */
export async function onAccountCreated(userId: string, anonId: string | null | undefined, requestedPath: unknown, opts: { selectedPlan?: string; marketingConsent?: boolean } = {}): Promise<string | null> {
  try {
    const intended = safeInternalPath(typeof requestedPath === "string" ? requestedPath : null);
    await linkSignup(userId, anonId, intended);
    if (opts.marketingConsent === true) await setMarketingConsent(userId, true, "signup");
    const moduleId = intended ? moduleForPath(intended.split("?")[0]) : null;
    if (!intended || !moduleId || opts.selectedPlan || !(await growthFlag("smart_onboarding_enabled"))) return null;
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { onboardingDone: true } }),
      prisma.growthProfile.update({ where: { userId }, data: { onboardingState: "contextual", intendedModule: moduleId } }),
    ]);
    return intended;
  } catch (e) {
    console.error("[growth] onAccountCreated failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
