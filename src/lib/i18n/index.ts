"use client";

import { useState, useEffect } from "react";
import en from "./en";
import fa from "./fa";
import de from "./de";

export type Lang = "fa" | "en" | "de";

function parseCookieLang(): Lang {
  if (typeof document === "undefined") return "fa";
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/);
  const val = match ? match[1] : null;
  return (val === "en" || val === "fa" || val === "de") ? val : "fa";
}

export function getLang(): Lang {
  return parseCookieLang();
}

export function setLang(lang: Lang) {
  document.cookie = `lang=${lang}; path=/; max-age=31536000`;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  window.location.reload();
}

const TRANSLATIONS: Record<Lang, typeof en> = { en, fa, de: de as typeof en };

export function useTranslation() {
  const [lang, setLangState] = useState<Lang>("fa");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  const t = TRANSLATIONS[lang];
  return { t, lang, setLang: (l: Lang) => { setLangState(l); setLang(l); } };
}

export { en, fa, de };

/**
 * Re-exported (not defined here) so server-side importers get the real
 * function, not a client-reference proxy — see tri.ts's doc comment for why.
 */
export { tri } from "./tri";
