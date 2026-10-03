"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";

export default function AdminNavShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const { lang } = useTranslation();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (open) drawer.current?.showModal(); else drawer.current?.close();
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia("(min-width:768px)");
    const close = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  return <>
    <div className="hidden md:flex h-full">{sidebar}</div>
    <main className="platform-main flex-1 overflow-y-auto">
      <header className="workspace-topbar flex md:hidden"><button className="workspace-icon-button" aria-label={tri(lang, "منوی مدیریت", "Admin menu", "Admin-Menü", "Yönetici menüsü")} aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20}/></button><span className="text-sm font-semibold">AIFekr / {tri(lang, "مدیریت", "Admin", "Verwaltung", "Yönetim")}</span><Link href="/home" className="workspace-icon-button" aria-label={tri(lang, "بازگشت به پلتفرم", "Back to workspace", "Zurück zum Arbeitsbereich", "Çalışma alanına dön")}><ArrowUpRight size={18}/></Link></header>
      {children}
    </main>
    <dialog ref={drawer} className="admin-mobile-drawer" onCancel={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} aria-label={tri(lang, "منوی مدیریت", "Admin menu", "Admin-Menü", "Yönetici menüsü")}>
      <div className="h-full relative"><button onClick={() => setOpen(false)} className="workspace-icon-button admin-drawer-close" aria-label={tri(lang, "بستن منو", "Close menu", "Menü schließen", "Menüyü kapat")}><X size={18}/></button>{sidebar}</div>
    </dialog>
  </>;
}
