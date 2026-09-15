import type { Lang } from "./index";

/**
 * Trilingual (now growing to a 4th language) helper — returns the correct
 * value for fa / en / de / tr.
 *
 * Deliberately its own file with NO "use client" directive. It used to live
 * inline in index.ts, which is "use client" (for useTranslation's hooks) —
 * every server-side route handler that did `import { tri } from
 * "@/lib/i18n"` was therefore pulling a plain, non-component function out of
 * a client-boundary module. Next's RSC/route-handler bundler can replace a
 * "use client" module's exports with client-reference proxy objects instead
 * of the real implementation depending on the route's bundle graph — which
 * is exactly why this crashed as "tri is not a function" in some server
 * routes (reproducibly, in `next build && next start`, not just dev) while
 * others happened to bundle fine. Only Lang (a type, erased at compile time)
 * is imported from index.ts, so this file has no runtime dependency on it.
 *
 * `tr` is OPTIONAL and defaults to the English string. This is deliberate:
 * Turkish support is being rolled out incrementally across hundreds of call
 * sites (see the plan in the commit that introduced this), and making `tr`
 * required would force editing every one of them in a single pass or break
 * the build. Every existing 4-argument call keeps compiling and now shows
 * (correct, readable) English to a Turkish user instead of throwing or
 * showing the wrong language entirely; passing a real Turkish string is a
 * pure improvement made call-site by call-site, highest-traffic first.
 */
export function tri<T>(lang: Lang, fa: T, en: T, de: T, tr?: T): T {
  if (lang === "fa") return fa;
  if (lang === "de") return de;
  if (lang === "tr") return tr ?? en;
  return en;
}
