"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutGrid, Search } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { findDestination, destinationLabel } from "@/lib/navigation/destinations";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/ui/CommandPalette";

export default function WorkspaceHeader() {
  const path = usePathname();
  const { lang } = useTranslation();
  const destination = findDestination(path);
  return <header className="workspace-topbar hidden md:flex">
    <nav aria-label={tri(lang, "مسیر فعلی", "Breadcrumb", "Navigationspfad", "Gezinti yolu")} className="workspace-breadcrumb">
      <Link href="/home" aria-label={tri(lang, "خانه", "Home", "Startseite", "Ana sayfa")}><LayoutGrid size={17}/></Link><ChevronRight size={13} aria-hidden/>
      <span>{destination ? destinationLabel(destination, lang) : path.startsWith("/checkout/") ? tri(lang, "پرداخت", "Checkout", "Zahlung", "Ödeme") : "AIFekr"}</span>
    </nav>
    <button className="workspace-search-trigger" aria-haspopup="dialog" aria-label={tri(lang, "جستجوی بخش‌های پلتفرم", "Search platform", "Plattform durchsuchen", "Platformda ara")} onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}><Search size={15}/><span>{tri(lang, "جستجو…", "Search…", "Suchen…", "Ara…")}</span><kbd>Ctrl K</kbd></button>
  </header>;
}
