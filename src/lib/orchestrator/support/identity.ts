import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

/**
 * Visual and naming identity for the floating support assistant.
 *
 * Kept separate from `src/lib/team/identity.ts` on purpose: that module's
 * `Teammate`/`Department` types model the four business departments and
 * their AI teammates (CEO, content team, accountant, sales lead) shown on the
 * Home page -- the support assistant is neither a department nor a business
 * teammate (its registry entry, "chat", has `department: null`), so forcing
 * it into that union would misrepresent what it is.
 *
 * The naming rule from that module still applies here: a ROLE name, never a
 * human one -- "a human name on something that is not human buys a little
 * warmth and risks the trust the product is actually selling."
 *
 * The colour is deliberately its own hue, distinct from all four department
 * colours (sales #ea580c, marketing #3b82f6, finance #1baf7a, strategy
 * #a855f7) and from `--primary` (which is itself #ea580c, the sales colour --
 * using it here would make the widget read as "the sales department").
 * Teal reads as "help/info" in most product UIs without colliding with any
 * existing brand or department meaning on this platform.
 */
export const SUPPORT_COLOR = "#0891b2";
export const SUPPORT_TINT = "rgba(8,145,178,0.16)";

export function supportAssistantName(lang: Lang): string {
  return tri(lang, "راهنمای AIFekr", "AIFekr Guide", "AIFekr-Guide");
}

/** Single-character avatar mark, mirroring the convention in `team/identity.ts`'s `teammateInitial`. */
export function supportAssistantInitial(lang: Lang): string {
  return lang === "fa" ? "ر" : "G";
}
