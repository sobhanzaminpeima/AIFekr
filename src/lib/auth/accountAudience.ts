export type AccountType = "PERSONAL" | "STUDENT" | "BUSINESS" | "FITNESS";
export function accountTypeFor(plan: unknown, choice: unknown): AccountType {
  if (typeof plan === "string" && plan.startsWith("STUDENT_")) return "STUDENT";
  if (typeof plan === "string" && (plan.startsWith("TEAM_") || plan.startsWith("CRM_"))) return "BUSINESS";
  if (typeof plan === "string" && plan.startsWith("FIT_")) return "FITNESS";
  return choice === "FITNESS" ? "FITNESS" : choice === "STUDENT" || choice === "BUSINESS" ? choice : "PERSONAL";
}
