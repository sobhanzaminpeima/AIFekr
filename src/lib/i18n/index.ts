"use client";

import { useState, useEffect } from "react";
import en from "./en";
import fa from "./fa";
import de from "./de";
import tr from "./tr";
import { useServerLang } from "./LangProvider";

export type Lang = "fa" | "en" | "de" | "tr";

function parseCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/);
  const val = match ? match[1] : null;
  return (val === "en" || val === "fa" || val === "de" || val === "tr") ? val : null;
}

// Returns null when there's no `lang` cookie yet, instead of silently
// defaulting to "fa" -- that hardcoded fallback is what used to make the
// mount-time useEffect in useTranslation() below stomp the correct
// server-resolved (DB-aware) language back to Persian on every page that had
// no cookie set. Callers that truly need a concrete Lang should fall back to
// the server-seeded value, not "fa".
export function getLang(): Lang | null {
  return parseCookieLang();
}

export function setLang(lang: Lang) {
  document.cookie = `lang=${lang}; path=/; max-age=31536000`;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  window.location.reload();
}

const TRANSLATIONS: Record<Lang, typeof en> = { en, fa, de: de as typeof en, tr };

export function useTranslation() {
  // Seeded from the server's own reading of the `lang` cookie, so the first
  // render already matches the reader. It used to start at "fa" unconditionally
  // and correct itself in the effect below, which meant the server HTML — and
  // the browser's first paint — was Persian for every English and German user.
  const serverLang = useServerLang();
  const [lang, setLangState] = useState<Lang>(serverLang ?? "fa");

  useEffect(() => {
    // Still runs: it picks up a language switch made after mount, and covers
    // any tree that has no provider above it. But only when a `lang` cookie
    // actually exists -- getLang() now returns null instead of a hardcoded
    // "fa" when there isn't one, so a visitor with no cookie keeps the
    // correct server-resolved (DB-aware) language instead of being flipped
    // back to Persian right after hydration.
    const cookieLang = getLang();
    if (cookieLang) setLangState(cookieLang);
  }, []);

  const t = TRANSLATIONS[lang];
  return { t, lang, setLang: (l: Lang) => { setLangState(l); setLang(l); } };
}

export { en, fa, de, tr };

/**
 * Re-exported (not defined here) so server-side importers get the real
 * function, not a client-reference proxy — see tri.ts's doc comment for why.
 */
export { tri } from "./tri";
