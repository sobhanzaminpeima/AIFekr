"use client";

import { useState, useEffect, useRef } from "react";
import { Globe } from "lucide-react";

type Lang = "fa" | "en" | "de";

const OPTIONS: { lang: Lang; flag: string; label: string }[] = [
  { lang: "fa", flag: "🇮🇷", label: "فارسی" },
  { lang: "en", flag: "🇬🇧", label: "English" },
  { lang: "de", flag: "🇩🇪", label: "Deutsch" },
];
const FLAG: Record<Lang, string> = { fa: "🇮🇷", en: "🇬🇧", de: "🇩🇪" };

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLangState(getLang());
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change language"
        className={`flex items-center justify-center transition-all ${iconOnly ? "w-8 h-8 rounded-lg" : "gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"} ${className}`}
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        {iconOnly ? (
          <span className="text-sm leading-none">{FLAG[lang]}</span>
        ) : (
          <>
            <Globe className="w-3.5 h-3.5" />
            <span className="text-sm leading-none">{FLAG[lang]}</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 z-50 py-1 rounded-xl shadow-2xl min-w-[140px]"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", insetInlineEnd: 0 }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.lang}
              onClick={() => { setOpen(false); applyLang(opt.lang); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              style={{
                background: lang === opt.lang ? "var(--surface-2)" : "transparent",
                color: lang === opt.lang ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: lang === opt.lang ? 600 : 400,
              }}
            >
              <span className="text-base leading-none">{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
