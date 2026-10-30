/**
 * Which menu sections an account sees. Shared by the classic Sidebar and the
 * new design's frame (/api/app/shell); access itself is enforced by each route.
 */
export function sidebarAccess(user: { crmPlan?: string | null; crmPlanExpiry?: string | Date | null; industryPackId?: string | null; accountType?: string | null } | null | undefined, now = Date.now()) {
  const crmPlanActive = !!user?.crmPlan && user.crmPlan !== "NONE" && (!user.crmPlanExpiry || new Date(user.crmPlanExpiry).getTime() > now);
  const hasPack = !!user?.industryPackId;
  const hasBusinessAccess = hasPack || crmPlanActive;
  const fitnessOnly = user?.accountType === "FITNESS";
  // Students get the university pack, which made the whole business menu
  // (and its upsell) appear for them; it is noise unless they run a CRM.
  const hideBusiness = (user?.accountType === "STUDENT" && !crmPlanActive) || fitnessOnly;
  return { crmPlanActive, hasPack, hasBusinessAccess, fitnessOnly, hideBusiness };
}
