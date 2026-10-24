"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ArrowUpRight } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { text } from "@/lib/marketing/catalog";
import { findModuleGuide } from "@/lib/navigation/moduleGuides";
import { findDestination, destinationLabel } from "@/lib/navigation/destinations";

export default function WorkspaceGuide() {
  const path = usePathname();
  const { lang } = useTranslation();
  const guide = findModuleGuide(path);
  // Full-height conversation tools already have their own contextual controls.
  if (!guide || path === "/ceo") return null;
  return <details className="workspace-guide" key={path}>
    <summary><Compass size={16} aria-hidden/><span>{tri(lang, "راهنمای این بخش", "Guide for this page", "Hilfe zu dieser Seite", "Bu sayfa için rehber")}</span></summary>
    <div><p>{text(lang, guide.purpose)}</p><nav aria-label={tri(lang, "ابزارهای مرتبط", "Related tools", "Passende Tools", "İlgili araçlar")}>{guide.links.map(href => { const destination = findDestination(href); return <Link href={href} key={href}>{destination ? destinationLabel(destination, lang) : href}<ArrowUpRight size={14}/></Link>; })}</nav></div>
  </details>;
}
