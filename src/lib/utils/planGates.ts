// Auto-publish (Instagram, and any future "system posts on your behalf"
// feature) is gated to higher-tier plans since it costs more to run
// reliably (scheduler + Graph API calls) — lower plans get the same AI
// content generation but must publish manually.
export function canAutoPublish(plan: string): boolean {
  return plan === "PRO" || plan === "TEAM";
}

/// CRM: FREE/ECHO get a capped contact list to try the feature; PLUS and up
/// get unlimited. -1 means unlimited, matching the convention in planLimits.ts.
export function crmContactLimit(plan: string): number {
  if (plan === "FREE" || plan === "ECHO") return 20;
  return -1;
}
