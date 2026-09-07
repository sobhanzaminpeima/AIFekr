"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { foundationCopy } from "@/lib/i18n/foundation";
import { Button } from "./foundation";

export default function LanguageSwitcher({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { lang, setLang } = useTranslation();
  const copy = foundationCopy[lang];
  const label = lang === "fa" ? copy.switchToEnglish : copy.switchToPersian;
  return (
    <Button locale={lang} variant="secondary" onClick={() => setLang(lang === "fa" ? "en" : "fa")}
      title={label} aria-label={label} className={`${iconOnly ? "ui-button--icon" : ""} ${className}`}>
      <Globe aria-hidden="true" />
      {!iconOnly && <span>{lang === "fa" ? "EN" : "FA"}</span>}
    </Button>
  );
}
