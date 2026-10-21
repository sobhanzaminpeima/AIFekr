export function standaloneChatOnly(user: {
  chatOnly?: boolean;
  plan?: string;
  crmPlan?: string;
  voicePlan?: string;
  industryPackId?: string | null;
  role?: string;
}) {
  return (
    !!user.chatOnly &&
    user.plan === "FREE" &&
    (!user.crmPlan || user.crmPlan === "NONE") &&
    (!user.voicePlan || user.voicePlan === "NONE") &&
    !user.industryPackId &&
    !["ADMIN", "SUPER_ADMIN"].includes(user.role ?? "")
  );
}
export function chatOnlyCoreApi(path: string) {
  return [
    "/api/auth/",
    "/api/ai-chat/",
    "/api/billing/",
    "/api/payment/",
    "/api/checkout/",
    "/api/bank/",
    "/api/user/profile",
    "/api/user/currency",
    "/api/user/payments",
    "/api/user/usage/history",
    "/api/profile",
    "/api/account",
    "/api/credits/",
    "/api/packages",
    "/api/plans",
    "/api/notifications",
    "/api/wallet",
    "/api/referral/",
  ].some((prefix) => path === prefix || path.startsWith(prefix));
}
