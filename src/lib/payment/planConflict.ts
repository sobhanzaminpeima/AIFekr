/** Packages that have their own expiry and never touch User.plan. */
const SEPARATE_CATEGORIES = ["CHAT_STARTER", "VIDEO_FACTORY", "FITNESS"];

/**
 * Student and the other main plans share User.plan. Buying one while the other
 * is paid and active would replace it and turn its remaining time into the new
 * plan, so the purchase waits until the current plan ends. Renewing the same
 * kind of plan, trials and add-ons with their own expiry are not affected.
 */
export function mainPlanConflict(
  user: { plan?: string | null; planExpiry?: Date | null; trialLimited?: boolean | null },
  planCode: string,
  category?: string | null,
  now = Date.now(),
): boolean {
  if (/^(CREDITS_|CRM_|VOICE_)/.test(planCode) || planCode === "FIT_MARKETPLACE") return false;
  if (category && SEPARATE_CATEGORIES.includes(category)) return false;
  if (!user.plan || user.plan === "FREE" || user.trialLimited) return false;
  if (user.planExpiry && user.planExpiry.getTime() <= now) return false;
  return user.plan.startsWith("STUDENT_") !== planCode.startsWith("STUDENT_");
}
