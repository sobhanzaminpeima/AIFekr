// Auto-publish (Instagram, and any future "system posts on your behalf"
// feature) is gated to higher-tier plans since it costs more to run
// reliably (scheduler + Graph API calls) — lower plans get the same AI
// content generation but must publish manually.
export function canAutoPublish(plan: string): boolean {
  return plan === "PRO" || plan === "TEAM";
}
