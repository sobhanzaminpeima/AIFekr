"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { foundationCopy, type UiLocale } from "@/lib/i18n/foundation";
import { Button } from "./foundation";

type Theme = "dark" | "light";

export default function ThemeSwitcher({ className = "", iconOnly = false, locale }: { className?: string; iconOnly?: boolean; locale?: UiLocale }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const { lang: appLang } = useTranslation();
  const lang = locale || appLang;
  const copy = foundationCopy[lang];

  useEffect(() => {
    // The root's server-rendered theme is authoritative, not stale localStorage.
    const sync = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
    try { localStorage.setItem("theme", next); } catch { /* Cookies still persist the preference. */ }
    setTheme(next);
  }

  const label = theme === "dark" ? copy.switchToLight : copy.switchToDark;
  return (
    <Button locale={lang} variant="secondary" onClick={toggle} title={label} aria-label={label}
      className={`${iconOnly ? "ui-button--icon" : ""} ${className}`}>
      {theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      {!iconOnly && <span>{theme === "dark" ? copy.dark : copy.light}</span>}
    </Button>
  );
}
