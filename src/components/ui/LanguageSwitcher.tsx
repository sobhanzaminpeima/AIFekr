"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 140;
const VIEWPORT_MARGIN = 8;

export default function LanguageSwitcher({ className = "", iconOnly = false, dropUp = false }: { className?: string; iconOnly?: boolean; dropUp?: boolean }) {
  const [lang, setLangState] = useState<Lang>("fa");
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setLangState(getLang());
    setMounted(true);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      // The menu is portalled out of `rootRef`, so it has to be tested
      // separately — otherwise every click on a language option would count
      // as "outside" and close the menu before the option's own handler ran.
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // A menu anchored with viewport coordinates has to be portalled to <body>.
  // Any ancestor with a transform, filter or backdrop-filter (the landing
  // page's animated navbar has backdrop-filter; the dashboard's mobile drawer
  // has transition-transform) becomes the containing block for
  // position:fixed children, so the menu would be offset by that element's
  // own origin and land off-screen — which is exactly how this button came
  // to look like it "did nothing" when clicked.
  useEffect(() => {
    if (!open) return;
    function reposition() { setOpen(false); }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Positioned with `fixed` + a clamped rect (instead of `absolute` anchored
  // to the button's own edge) so the menu can't get clipped off-screen when
  // the button sits near a viewport edge (e.g. the sidebar's bottom icon row).
  function toggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const left = Math.min(Math.max(rect.right - MENU_WIDTH, VIEWPORT_MARGIN), window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN);
      const top = dropUp
        ? Math.max(rect.top - 4, VIEWPORT_MARGIN)
        : Math.min(rect.bottom + 4, window.innerHeight - VIEWPORT_MARGIN);
      setMenuPos({ top, left });
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        onClick={toggleOpen}
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

      {open && menuPos && mounted && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] py-1 rounded-xl shadow-2xl"
          style={{
            background: "var(--surface-1)", border: "1px solid var(--border)",
            width: MENU_WIDTH,
            top: dropUp ? undefined : menuPos.top,
            bottom: dropUp ? window.innerHeight - menuPos.top : undefined,
            left: menuPos.left,
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
