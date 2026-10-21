"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";

type Theme = "dark" | "light";

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem("theme") === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
  document.documentElement.dataset.theme = theme;
}

export default function ThemeSwitcher({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const { lang } = useTranslation();
  const label = theme === "dark" ? tri(lang, "تغییر به تم روشن", "Switch to light theme", "Helles Design aktivieren", "Açık temaya geç") : tri(lang, "تغییر به تم تیره", "Switch to dark theme", "Dunkles Design aktivieren", "Koyu temaya geç");

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center transition-all ${iconOnly ? "w-8 h-8 rounded-lg" : "gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"} ${className}`}
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      {!iconOnly && <span>{theme === "dark" ? tri(lang, "تیره", "Dark", "Dunkel", "Koyu") : tri(lang, "روشن", "Light", "Hell", "Açık")}</span>}
    </button>
  );
}
