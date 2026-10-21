import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";
export type StudentEntryUser = { accountType?: string; plan?: string; planExpiry?: string | Date | null; featureAccess?: boolean };
export function studentEntryHref(user: StudentEntryUser | null, plan = STUDENT_PLAN_CODE, intent: "workspace" | "purchase" = "workspace") {
  if (!user) return `/register?plan=${encodeURIComponent(plan)}&period=monthly`;
  const active = user.accountType === "STUDENT" && user.plan?.startsWith("STUDENT_") && !!user.planExpiry && new Date(user.planExpiry).getTime() > Date.now() && user.featureAccess !== false;
  return intent === "workspace" && active ? "/student" : `/plans?plan=${encodeURIComponent(plan)}&period=monthly`;
}
