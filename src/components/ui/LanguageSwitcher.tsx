"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";

type Lang = "fa" | "en" | "de";

const ORDER: Lang[] = ["fa", "en", "de"];
const LABEL: Record<Lang, string> = { fa: "FA", en: "EN", de: "DE" };
const NEXT_LABEL: Record<Lang, string> = {
  fa: "Switch to English",
  en: "Auf Deutsch umschalten (beta)",
  de: "تغییر به فارسی",
};

function getLang(): Lang {
  if (typeof window === "undefined") return "fa";
  const v = localStorage.getItem("lang");
  return v === "en" || v === "fa" || v === "de" ? v : "fa";
}

function applyLang(lang: Lang) {
  localStorage.setItem("lang", lang);
  document.cookie = `lang=${lang}; path=/; max-age=31536000`;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  window.location.reload();
}

export default function LanguageSwitcher({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [lang, setLangState] = useState<Lang>("fa");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  function toggle() {
    const next = ORDER[(ORDER.indexOf(lang) + 1) % ORDER.length];
    applyLang(next);
  }

  return (
    <button
      onClick={toggle}
      title={NEXT_LABEL[lang]}
      className={`flex items-center justify-center transition-all ${iconOnly ? "w-8 h-8 rounded-lg" : "gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"} ${className}`}
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      <Globe className="w-3.5 h-3.5" />
      {!iconOnly && <span>{LABEL[lang]}</span>}
    </button>
  );
}
