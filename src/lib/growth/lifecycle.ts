import type { GrowthSettings } from "./config";

/** Everything the engine knows about one customer, read from authoritative tables (see facts.ts). */
export type CustomerFacts = {
  userId: string;
  createdAt: Date;
  plan: string;
  planExpiry: Date | null;
  credits: number;
  role: string;
  onboardingDone: boolean;
  onboardingState: string;
  /** moduleId -> successful operations (artifact rows) and the first one's time. */
  successes: Record<string, { count: number; first: Date }>;
  failedOperations: number;
  creditsUsedWindow: number;
  activeDaysWindow: number;
  lastActiveAt: Date | null;
  pricingViewsWindow: number;
  demoRequests: number;
  checkoutsWindow: number;
  payments: { success: number; failed: number; pending: number; revenueToman: number; firstPaidAt: Date | null; lastFailedAt: Date | null };
  unsubscribed: boolean;
  marketingConsent: boolean;
};

export type Stage = "signed_up" | "onboarding" | "activated" | "engaged" | "purchase_intent" | "paid" | "renewed" | "at_risk" | "churned";

const DAY = 86_400_000;
export const daysSince = (d: Date | null, now: Date) => d ? Math.floor((now.getTime() - d.getTime()) / DAY) : Infinity;

export function firstValueAt(f: CustomerFacts): Date | null {
  const firsts = Object.values(f.successes).map(s => s.first.getTime());
  return firsts.length ? new Date(Math.min(...firsts)) : null;
}
export const totalSuccesses = (f: CustomerFacts) => Object.values(f.successes).reduce((n, s) => n + s.count, 0);
export const isPaidActive = (f: CustomerFacts, now: Date) => f.plan !== "FREE" && !!f.planExpiry && f.planExpiry.getTime() > now.getTime() && f.payments.success > 0;
export const onboardingFinished = (f: CustomerFacts) => f.onboardingDone || ["completed", "contextual"].includes(f.onboardingState);

/** Reasons a paying customer needs attention; rules of thumb, not a validated churn prediction. */
export function riskReasons(f: CustomerFacts, s: GrowthSettings, now: Date): string[] {
  if (!isPaidActive(f, now)) return [];
  const out: string[] = [];
  if (daysSince(f.lastActiveAt, now) >= s.thresholds.atRiskPaidInactiveDays) out.push("inactive_paid");
  if (f.payments.lastFailedAt && daysSince(f.payments.lastFailedAt, now) <= 14) out.push("payment_failed");
  if (f.planExpiry && f.planExpiry.getTime() - now.getTime() <= s.thresholds.renewalSoonDays * DAY && f.activeDaysWindow < 2) out.push("renewal_soon_low_usage");
  return out;
}

export function stageFor(f: CustomerFacts, s: GrowthSettings, now: Date): Stage {
  if (isPaidActive(f, now)) return riskReasons(f, s, now).length ? "at_risk" : f.payments.success >= 2 ? "renewed" : "paid";
  if (f.payments.success > 0) return "churned";
  if (f.checkoutsWindow > 0 || f.pricingViewsWindow > 0 || f.demoRequests > 0) return firstValueAt(f) ? "purchase_intent" : onboardingFinished(f) ? "onboarding" : "signed_up";
  if (firstValueAt(f)) return f.activeDaysWindow >= s.thresholds.engagedActiveDays ? "engaged" : "activated";
  return onboardingFinished(f) ? "onboarding" : "signed_up";
}

export type ScoreLine = { rule: keyof GrowthSettings["weights"]; points: number; evidence: string };

/**
 * Explainable rules score, 0-100. Each rule counts once per scoring window
 * (no unlimited repeat points). The weights are hypotheses an admin can
 * tune -- this is a prioritisation aid, not a purchase probability.
 */
export function scoreFor(f: CustomerFacts, s: GrowthSettings): { score: number; lines: ScoreLine[] } {
  const w = s.weights, lines: ScoreLine[] = [];
  const add = (rule: ScoreLine["rule"], ok: boolean, evidence: string) => { if (ok && w[rule] > 0) lines.push({ rule, points: w[rule], evidence }); };
  add("onboardingCompleted", onboardingFinished(f), f.onboardingState);
  const fv = firstValueAt(f);
  add("firstValue", !!fv, fv ? `${Object.keys(f.successes).join(", ")}` : "");
  add("returnedAnotherDay", f.activeDaysWindow >= 2, `${f.activeDaysWindow} active days`);
  add("repeatedModuleUse", Object.values(f.successes).some(x => x.count >= 3), `${totalSuccesses(f)} successful operations`);
  add("pricingViewed", f.pricingViewsWindow > 0, `${f.pricingViewsWindow} pricing views`);
  add("checkoutStarted", f.checkoutsWindow > 0, `${f.checkoutsWindow} checkouts`);
  add("demoRequested", f.demoRequests > 0, `${f.demoRequests} requests`);
  const max = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return { score: Math.round(lines.reduce((n, l) => n + l.points, 0) * 100 / max), lines };
}

export type Band = "activation" | "nurture" | "sales";
export const bandFor = (score: number, s: GrowthSettings): Band => score >= s.thresholds.salesBand ? "sales" : score >= s.thresholds.nurtureBand ? "nurture" : "activation";

export const SEGMENTS = ["new", "unactivated", "activated_free", "engaged_free", "high_intent", "low_credit", "inactive", "paying", "at_risk_paying", "renewed", "cancelled"] as const;
export type Segment = typeof SEGMENTS[number];

/** Segment membership; every threshold comes from settings and is shown to admins in the definitions panel. */
export function segmentsFor(f: CustomerFacts, s: GrowthSettings, now: Date, score: number): Segment[] {
  const t = s.thresholds, paid = isPaidActive(f, now), fv = !!firstValueAt(f), out: Segment[] = [];
  if (daysSince(f.createdAt, now) < t.newUserDays) out.push("new");
  if (!fv) out.push("unactivated");
  if (fv && !paid) out.push("activated_free");
  if (fv && !paid && f.activeDaysWindow >= t.engagedActiveDays) out.push("engaged_free");
  if (!paid && score >= t.highIntentScore) out.push("high_intent");
  if (f.credits <= t.lowCredits) out.push("low_credit");
  if (daysSince(f.lastActiveAt ?? f.createdAt, now) >= t.inactiveDays) out.push("inactive");
  if (paid) out.push("paying");
  if (riskReasons(f, s, now).length) out.push("at_risk_paying");
  if (paid && f.payments.success >= 2) out.push("renewed");
  if (!paid && f.payments.success > 0) out.push("cancelled");
  return out;
}

export function evaluate(f: CustomerFacts, s: GrowthSettings, now: Date) {
  const { score, lines } = scoreFor(f, s);
  return { stage: stageFor(f, s, now), score, band: bandFor(score, s), lines, segments: segmentsFor(f, s, now, score), risks: riskReasons(f, s, now), firstValueAt: firstValueAt(f) };
}
