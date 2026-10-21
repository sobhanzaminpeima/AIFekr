"use client";

import { useEffect, useState } from "react";

/**
 * Keeps the credit balance shown in the sidebar honest.
 *
 * The balance used to be rendered once by the server layout, and Next.js does not
 * re-run a layout on client-side navigation -- so after pressing a credit-costing
 * button the sidebar kept showing the old number until a full reload, and it looked
 * as if nothing had been deducted. We now watch API calls: after a call that may have
 * spent credits, re-read the balance (a few times, since streamed answers charge when
 * they finish).
 */
export const CREDITS_REFRESH_EVENT = "aifekr:credits-refresh";

/** GET endpoints that spend credits (everything else that spends is a POST/PUT/PATCH). */
const BILLED_GET = /\/api\/(crm\/(lead-matcher|agency-report|properties\/[^/]+\/(pricing-advice|listing-copy))|ceo\/orchestrator\/follow-up-drafts|sales\/followups)(\?|$)/;
const IGNORE = /\/api\/(user\/profile|credits\/|auth\/|support\/)/;

/** When to re-read the balance after a possibly-charging call (ms): quick calls, then streamed ones. */
const DELAYS = [1200, 12000, 35000];

let installed = false;
let timers: ReturnType<typeof setTimeout>[] = [];

function scheduleRefresh() {
  timers.forEach(clearTimeout);
  timers = DELAYS.map((ms) => setTimeout(() => window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT)), ms));
}

export function shouldRefreshAfter(url: string, method: string): boolean {
  if (!url.includes("/api/") || IGNORE.test(url)) return false;
  return method.toUpperCase() !== "GET" || BILLED_GET.test(url);
}

/** Wraps window.fetch once (idempotent) so a successful call to a billing endpoint schedules a balance refresh. */
export function installCreditsWatcher() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");
      if (res.ok && shouldRefreshAfter(url, method)) scheduleRefresh();
    } catch { /* never let bookkeeping break a request */ }
    return res;
  };
}

/** Balance that follows the server's, starting from the value the page was rendered with. */
export function useLiveCredits(initial: number): number {
  const [credits, setCredits] = useState(initial);
  useEffect(() => { setCredits(initial); }, [initial]);

  useEffect(() => {
    installCreditsWatcher();
    let alive = true;
    const refresh = async () => {
      try {
        const r = await fetch("/api/user/profile", { credentials: "include" });
        if (!r.ok) return;
        const d = await r.json();
        const next = d?.user?.displayCredits;
        if (alive && typeof next === "number") setCredits(next);
      } catch { /* keep the last known balance */ }
    };
    window.addEventListener(CREDITS_REFRESH_EVENT, refresh);
    // Coming back to the tab after work elsewhere (another tab, a cron-driven run) should also catch up.
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { alive = false; window.removeEventListener(CREDITS_REFRESH_EVENT, refresh); window.removeEventListener("focus", onFocus); };
  }, []);

  return credits;
}
