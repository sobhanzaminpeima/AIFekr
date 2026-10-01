export function shouldShowTrialBanner(input: {
  trialEndsAt: Date | string | null | undefined;
  plan: string;
  planExpiry: Date | string | null | undefined;
}, now = Date.now()): boolean {
  if (!input.trialEndsAt) return false;
  const trialEnd = new Date(input.trialEndsAt).getTime();
  if (!Number.isFinite(trialEnd)) return false;

  // A still-running trial should retain its countdown even though its trial
  // package is represented by a normal plan. Once that trial has ended, an
  // active paid plan takes precedence over the stale trial audit timestamp.
  if (trialEnd > now) return true;
  if (input.plan === "FREE") return true;

  if (!input.planExpiry) return false;
  const planEnd = new Date(input.planExpiry).getTime();
  return !Number.isFinite(planEnd) || planEnd <= now;
}
