import { publicAppUrl } from "@/lib/utils/publicAppUrl";
export function safeGoogleRedirect(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f]/.test(value) || value.length > 1000) return null;
  try { const url = new URL(value, publicAppUrl()); return url.origin === publicAppUrl() ? `${url.pathname}${url.search}${url.hash}` : null; } catch { return null; }
}
export function googleContext(params: URLSearchParams) {
  const plan = params.get("plan") || "";
  const language = params.get("language") || "";
  const ref = params.get("ref") || "";
  const promoCode = params.get("promo") || "";
  return { selectedPlan: /^[A-Z0-9_]{1,80}$/.test(plan) ? plan : "", period: ["monthly","quarterly","semiannual","annual"].includes(params.get("period")||"") ? params.get("period")! : "monthly", language: ["fa","en","de","tr"].includes(language) ? language : "", accountType: ["PERSONAL","BUSINESS","STUDENT"].includes(params.get("accountType")||"") ? params.get("accountType")! : "PERSONAL", ref: ref.slice(0,100), promoCode: promoCode.slice(0,100), redirect: safeGoogleRedirect(params.get("redirect")) };
}
export function readGoogleContext(raw: string | undefined) {
  try { const parsed = JSON.parse(raw || "{}"); return googleContext(new URLSearchParams({plan:parsed.selectedPlan||"",period:parsed.period||"",language:parsed.language||"",accountType:parsed.accountType||"",ref:parsed.ref||"",promo:parsed.promoCode||"",redirect:parsed.redirect||""})); } catch { return googleContext(new URLSearchParams()); }
}
