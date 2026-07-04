"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as Theme) || "dark";
}

function applyTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
  document.documentElement.dataset.theme = theme;
}

export default function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");

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
      title={theme === "dark" ? "تغییر به تم روشن" : "تغییر به تم تیره"}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${className}`}
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      <span>{theme === "dark" ? "تیره" : "روشن"}</span>
    </button>
  );
}
