export type AccountType = "PERSONAL" | "STUDENT" | "BUSINESS";
export function accountTypeFor(plan: unknown, choice: unknown): AccountType {
  if (typeof plan === "string" && plan.startsWith("STUDENT_")) return "STUDENT";
  if (typeof plan === "string" && (plan.startsWith("TEAM_") || plan.startsWith("CRM_"))) return "BUSINESS";
  return choice === "STUDENT" || choice === "BUSINESS" ? choice : "PERSONAL";
}
