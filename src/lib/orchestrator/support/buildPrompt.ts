import type { Lang } from "@/lib/i18n";
import type { KbHit } from "../kb/search";
import { getCapability, isReachable, type Capability } from "../registry";

/**
 * Turns retrieval results into (a) the reference-document text handed to the
 * model and (b) a navigation target the client renders as a real button --
 * chosen here, from the registry, rather than left for the model to name in
 * free text (Phase 1 architecture, §6: "a navigation target chosen from the
 * registry, not free-text").
 *
 * Kept as pure functions (no Prisma, no fetch) so the retrieval → prompt
 * logic is unit-testable without a database or a model call.
 */

export interface NavigationTarget {
  href: string;
  label: string;
  /** False when the user's current plan/add-ons don't reach this capability -- the button still links there (real gates already live on the destination), but the UI can show that honestly. */
  reachable: boolean;
}

export interface ReachabilityContext {
  plan: string;
  crmPlan: string;
  voicePlan?: string | null;
}

/**
 * The single most relevant destination for this query: the capability behind
 * the top knowledge-base hit if the hit belongs to one, otherwise the top
 * capability-name match. Returns null when nothing matched at all -- there is
 * nowhere honest to send the user.
 */
export function pickNavigationTarget(hits: KbHit[], capMatches: Capability[], lang: Lang, reachCtx: ReachabilityContext): NavigationTarget | null {
  const fromHit = hits[0]?.capabilityKey ? getCapability(hits[0].capabilityKey) : undefined;
  const cap = fromHit ?? capMatches[0];
  if (!cap) return null;
  return { href: cap.href, label: cap.label(lang), reachable: isReachable(cap, reachCtx) };
}

const NO_CONTEXT_NOTE: Record<Lang, string> = {
  fa: "(هیچ سند مرتبطی در نالج‌بیس پیدا نشد — اگر واقعاً نمی‌دانی، صادقانه بگو نمی‌دانی، حدس نزن.)",
  en: "(No relevant document was found in the knowledge base — if you genuinely don't know, say so honestly rather than guessing.)",
  de: "(In der Wissensdatenbank wurde kein passendes Dokument gefunden — wissen Sie es wirklich nicht, sagen Sie das ehrlich, statt zu raten.)",
  tr: "(No relevant document was found in the knowledge base — if you genuinely don't know, say so honestly rather than guessing.)",
};

const DOC_HEADER: Record<Lang, string> = {
  fa: "اسناد مرجع مرتبط:",
  en: "Relevant reference documents:",
  de: "Relevante Referenzdokumente:",
  tr: "Relevant reference documents:",
};

const RELATED_HEADER: Record<Lang, string> = {
  fa: "بخش‌های مرتبط پلتفرم:",
  en: "Related platform sections:",
  de: "Verwandte Plattformbereiche:",
  tr: "Related platform sections:",
};

const GATED_NOTE: Record<Lang, (label: string) => string> = {
  fa: (label) => `توجه: «${label}» برای این کاربر هنوز فعال نیست (پلن/افزونهٔ لازم را ندارد) — این را صادقانه بگو، وانمود نکن که بدون محدودیت در دسترس است.`,
  en: (label) => `Note: "${label}" is not yet available to this user (missing the required plan/add-on) — say so honestly rather than implying unrestricted access.`,
  de: (label) => `Hinweis: „${label}" steht diesem Nutzer noch nicht zur Verfügung (fehlendes Tarif-/Add-on) — sagen Sie das ehrlich, statt uneingeschränkten Zugriff zu suggerieren.`,
  tr: (label) => `Note: "${label}" is not yet available to this user (missing the required plan/add-on) — say so honestly rather than implying unrestricted access.`,
};

/**
 * Builds the "reference documents" block that goes into the user-role
 * message alongside the question — never into the system prompt, matching
 * the untrusted/reference-content framing already used elsewhere in this
 * codebase (`wrapUntrustedContent`). Unlike that helper this content is
 * admin-authored, not user-controlled, so it carries no injection-defence
 * framing — just a clear "this is data to answer from" label.
 */
export function buildSupportContext(hits: KbHit[], capMatches: Capability[], nav: NavigationTarget | null, lang: Lang): string {
  if (hits.length === 0 && capMatches.length === 0) return NO_CONTEXT_NOTE[lang];

  const parts: string[] = [];

  if (hits.length) {
    // h.text already carries its own "Document title — Section heading"
    // context line (see kb/parse.ts) so no extra heading markup is added here.
    parts.push(`${DOC_HEADER[lang]}\n\n${hits.map((h) => h.text).join("\n\n---\n\n")}`);
  }

  if (capMatches.length) {
    parts.push(`${RELATED_HEADER[lang]}\n${capMatches.map((c) => `- ${c.label(lang)}: ${c.blurb(lang)} (${c.href})`).join("\n")}`);
  }

  if (nav && !nav.reachable) parts.push(GATED_NOTE[lang](nav.label));

  return parts.join("\n\n");
}
