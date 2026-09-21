import type { Lang } from "@/lib/i18n";

/**
 * Intent resolution for `full_mode` (Phase 1, §6).
 *
 * Cheap first, model only when necessary. A keyword pass plus a sticky
 * "previous domain" resolves the clear majority of turns for free; only a
 * genuinely ambiguous message is worth an LLM classification call.
 *
 * Patterns follow the trilingual style already used by `detectQueryType()` in
 * src/lib/ai/router.ts — this is the same idea applied per business domain
 * rather than per query type.
 *
 * Deliberately conservative: when nothing matches, the answer is "no domain",
 * and the caller falls through to ordinary chat rather than speculatively
 * reading someone's business data because a message mentioned "money".
 */

export type DomainKey = "crm" | "accounting" | "social" | "ceo" | "seo";

const DOMAIN_PATTERNS: Record<DomainKey, RegExp> = {
  crm: /\b(crm|lead|leads|contact|contacts|deal|deals|pipeline|prospect|follow[- ]?up|customer|client)\b|لید|مخاطب|معامله|قیف|پیگیری|مشتری|فروش|Kontakt|Kunde|Deal|Pipeline|Lead|Nachverfolgung/i,
  accounting: /\b(accounting|ledger|invoice|invoices|expense|expenses|spend|spending|cash[- ]?flow|payroll|tax|bookkeep)\b|حساب(داری)?|فاکتور|هزینه|دفتر کل|جریان نقدی|حقوق|مالیات|Buchhaltung|Rechnung|Ausgabe|Hauptbuch|Lohn|Steuer/i,
  social: /\b(instagram|insta|social|post|posts|caption|hashtag|reel|story|follower|engagement)\b|اینستاگرام|اینستا|پست|کپشن|هشتگ|ریلز|استوری|فالوور|تعامل|شبکه(‌| )اجتماعی|Beitrag|Caption|Hashtag|Follower/i,
  seo: /\b(seo|serp|sitemap|backlinks?|search engines?|google ranking|my rankings?|rank(ing)? (on|in) google|meta descriptions?|keyword research|wordpress|yoast|rank ?math|mobile[- ]friendly|core web vitals|site audit|website audit|seo audit)\b|سئو|موتور(های)? جستجو|رتبه(‌| )?(سایت|گوگل|من)|کلمات? کلیدی|وردپرس|نقشه سایت|بک ?لینک|تحلیل (وب‌?سایت|سایت)|امتیاز سئو|سایت[‌ ]?(من|م)|وب‌?سایت[‌ ]?(من|م)|Suchmaschine|Suchmaschinenoptimierung|Ranking|Keyword-?Recherche|Meta-?Beschreibung|Website-?Analyse|meine Website|Backlink/i,
  ceo: /\b(overall|whole business|big picture|strategy|priorities|how is my business|overview)\b|کل کسب[‌ ]?و[‌ ]?کار|وضعیت کلی|اولویت|استراتژی|تصویر کلی|Gesamtbild|Strategie|Priorität|Gesamtüberblick/i,
};

/** Follow-ups that carry no domain word of their own and should stay wherever the last turn was. */
const CONTINUATION_PATTERN =
  /^(and |also |what about |how about |ok|okay|yes|no|more|why|و |بعد|پس|باشه|بله|خیر|چرا|بیشتر|und |auch |warum |mehr )/i;

export interface IntentResult {
  domains: DomainKey[];
  /** How the decision was reached — surfaced for logging, and to decide whether a model pass is warranted. */
  basis: "keyword" | "sticky" | "none";
}

/**
 * Resolves which business domains a message is about.
 *
 * `lastDomain` makes short follow-ups work: "and what about last month?" has
 * no domain word in it, but it obviously belongs to whatever was just being
 * discussed.
 */
export function resolveIntent(message: string, lastDomain: DomainKey | null): IntentResult {
  const matched = (Object.keys(DOMAIN_PATTERNS) as DomainKey[]).filter((d) => DOMAIN_PATTERNS[d].test(message));

  if (matched.length > 0) {
    // A whole-business question that also trips a specific domain word is
    // still a whole-business question -- but a specific domain word plus a
    // vague "overall" is better served by the specific tools, so `ceo` only
    // wins when it is the only match.
    if (matched.length > 1 && matched.includes("ceo")) {
      return { domains: matched.filter((d) => d !== "ceo"), basis: "keyword" };
    }
    return { domains: matched, basis: "keyword" };
  }

  const trimmed = message.trim();
  if (lastDomain && (CONTINUATION_PATTERN.test(trimmed) || trimmed.length <= 30)) {
    return { domains: [lastDomain], basis: "sticky" };
  }

  return { domains: [], basis: "none" };
}

/**
 * The bounded, typed conversation state carried between turns (Phase 1, §5.2).
 *
 * Bounded on purpose: token cost stays flat as a conversation grows, a
 * reviewer can see exactly what the model was told, and — because entity ids
 * here are always re-validated against the workspace before use — it cannot
 * become a channel for stale or cross-workspace references.
 */
export interface RoutingState {
  lastDomain: DomainKey | null;
  entities: Array<{ domain: DomainKey; kind: string; id: string; label: string }>;
}

const MAX_ENTITIES = 8;

export function emptyRoutingState(): RoutingState {
  return { lastDomain: null, entities: [] };
}

export function parseRoutingState(json: string | null | undefined): RoutingState {
  if (!json) return emptyRoutingState();
  try {
    const parsed = JSON.parse(json) as Partial<RoutingState>;
    const entities = Array.isArray(parsed.entities)
      ? parsed.entities
          .filter(
            (e): e is RoutingState["entities"][number] =>
              !!e && typeof e.id === "string" && typeof e.kind === "string" && typeof e.label === "string"
          )
          .slice(-MAX_ENTITIES)
      : [];
    const lastDomain =
      parsed.lastDomain && ["crm", "accounting", "social", "ceo", "seo"].includes(parsed.lastDomain)
        ? (parsed.lastDomain as DomainKey)
        : null;
    return { lastDomain, entities };
  } catch {
    return emptyRoutingState();
  }
}

export function serializeRoutingState(state: RoutingState): string {
  return JSON.stringify({ lastDomain: state.lastDomain, entities: state.entities.slice(-MAX_ENTITIES) });
}

/** Renders the state into the short context line the model sees. Ids are included so the model can echo one back into a tool call. */
export function describeRoutingState(state: RoutingState, lang: Lang): string {
  if (!state.lastDomain && state.entities.length === 0) return "";

  const label =
    lang === "fa" ? "زمینهٔ مکالمهٔ قبلی" : lang === "de" ? "Kontext des bisherigen Gesprächs" : "Context from earlier in this conversation";
  const lines: string[] = [];
  if (state.lastDomain) lines.push(`last topic: ${state.lastDomain}`);
  for (const e of state.entities) lines.push(`${e.domain}/${e.kind}: ${e.label} (id ${e.id})`);
  return `${label}:\n${lines.join("\n")}`;
}
