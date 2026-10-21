/**
 * Server-side plan enforcement helpers.
 * Use these in API routes to gate features behind active subscriptions.
 */

type User = { plan: string; planExpiry: Date | null };

/**
 * Returns true if the user's plan is active (not expired).
 * FREE plan never expires.
 */
export function isPlanActive(user: User): boolean {
  if (user.plan === "FREE") return true;
  if (!user.planExpiry) return false;
  return new Date(user.planExpiry) > new Date();
}

/**
 * Returns the effective plan — falls back to FREE if plan is expired.
 */
export function effectivePlan(user: User): string {
  return isPlanActive(user) ? user.plan : "FREE";
}

const PLAN_RANK: Record<string, number> = {
  FREE: 0, BASIC: 1, PRO: 2, BUSINESS: 3, TEAM: 4, AGENCY: 5,
};

/**
 * Returns true if the user has at least the required plan (and it's active).
 */
export function hasPlan(user: User, required: string): boolean {
  const eff = effectivePlan(user);
  return (PLAN_RANK[eff] ?? 0) >= (PLAN_RANK[required] ?? 0);
}

// Module → minimum required plan
export const MODULE_PLANS: Record<string, string> = {
  chat: "FREE",
  image: "FREE",
  video: "PRO",
  music: "PRO",
  crm: "FREE",     // CRM has its own crmPlan add-on gate
  seo: "PRO",
  social: "PRO",
  "business-doctor": "BUSINESS",
  ceo: "BUSINESS",
  "voice-agent": "FREE",  // voice-agent has its own voicePlan gate
  startup: "PRO",
  "website-designer": "PRO",
  games: "FREE",   // games are free-to-play
};
