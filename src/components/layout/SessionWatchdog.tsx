"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";

/**
 * Turns an expired session into a clear, localised prompt instead of an action
 * that silently does nothing.
 *
 * QA 2026-09-15 (U05): with a session that had lapsed in an open tab, creating
 * a lead form failed twice with no message at all — several call sites do
 * `if (!res.ok) throw new Error()` with no text — and only a later navigation
 * revealed the login page. The user had no way to know they needed to sign in
 * again, and retried into the same void.
 *
 * A single wrapper around `fetch` is deliberate: the alternative is auditing
 * every one of the hundreds of call sites, and any new one would reintroduce
 * the gap. It changes nothing about the response — callers still see the 401
 * and handle it however they already do — it only guarantees the user is told.
 */

const REDIRECT_DELAY_MS = 1800;

export default function SessionWatchdog({ lang }: { lang: Lang }) {
  useEffect(() => {
    const original = window.fetch;
    // Guards against double-patching under React strict mode / fast refresh.
    if ((window.fetch as { __sessionWatchdog?: boolean }).__sessionWatchdog) return;

    let handled = false;

    const patched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);

      if (res.status !== 401 || handled) return res;

      // Only our own API — a 401 from a third-party endpoint says nothing about
      // this user's session.
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let isOwnApi: boolean;
      try {
        isOwnApi = new URL(url, window.location.origin).origin === window.location.origin && new URL(url, window.location.origin).pathname.startsWith("/api/");
      } catch {
        isOwnApi = false;
      }
      if (!isOwnApi) return res;

      // The login and auth routes answer 401 as their normal "wrong password"
      // path — that is not an expired session.
      if (new URL(url, window.location.origin).pathname.startsWith("/api/auth/")) return res;

      handled = true;
      toast.error(
        tri(lang,
          "نشست شما منقضی شده است. در حال انتقال به صفحهٔ ورود...",
          "Your session has expired. Redirecting you to sign in...",
          "Ihre Sitzung ist abgelaufen. Sie werden zur Anmeldung weitergeleitet..."),
        { duration: REDIRECT_DELAY_MS }
      );

      // Long enough to read, and `redirect` brings them back to the page they
      // were on rather than dumping them at the dashboard root. That is the
      // param name the login page already reads, and it rejects anything that
      // isn't a same-origin relative path (see getSafeRedirect there).
      setTimeout(() => {
        const back = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?redirect=${back}`;
      }, REDIRECT_DELAY_MS);

      return res;
    };

    (patched as { __sessionWatchdog?: boolean }).__sessionWatchdog = true;
    window.fetch = patched;
    return () => { window.fetch = original; };
  }, [lang]);

  return null;
}
