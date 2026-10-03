"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Sparkles, GalleryHorizontal, User, Search } from "lucide-react";
import CommandPalette, { OPEN_COMMAND_PALETTE_EVENT } from "@/components/ui/CommandPalette";
import NotificationBell from "@/components/layout/NotificationBell";
import WorkspaceHeader from "./WorkspaceHeader";
import WorkspaceGuide from "./WorkspaceGuide";
import { tri } from "@/lib/i18n";

/**
 * Fired whenever the mobile drawer opens or closes, so sibling `fixed`
 * elements outside this component's own subtree -- currently just
 * FloatingSupportWidget, mounted alongside <MobileNavShell> in the dashboard
 * layout -- can hide themselves while the drawer covers the screen. A plain
 * window event rather than React context because the dashboard layout that
 * parents both is a server component: there's no client tree above them to
 * hold shared state in, and this is one boolean, not worth restructuring the
 * layout into a client wrapper for.
 */
export const MOBILE_DRAWER_EVENT = "aifekr:mobile-drawer";

export default function MobileNavShell({
  sidebar, children, lang,
}: { sidebar: React.ReactNode; children: React.ReactNode; lang: "fa" | "en" | "de" | "tr" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); mainRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const content = mainRef.current;
    if (content) content.inert = true;
    const media = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", onResize);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select,[tabindex="0"]') || []).filter(item => item.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onResize);
      if (content) content.inert = false;
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MOBILE_DRAWER_EVENT, { detail: { open } }));
  }, [open]);
  const isChatPage = pathname === "/chat" || pathname?.startsWith("/chat/");
  // Persian is the only RTL language here — anything else reads left-to-right.
  const dir = lang === "fa" ? "rtl" : "ltr";

  const LABELS = {
    fa: { chat: "چت", agents: "ایجنت‌ها", gallery: "ساخته‌های من", settings: "تنظیمات" },
    en: { chat: "Chat", agents: "Agents", gallery: "My creations", settings: "Settings" },
    de: { chat: "Chat", agents: "Agenten", gallery: "Meine Werke", settings: "Einstellungen" },
    tr: { chat: "Sohbet", agents: "Ajanlar", gallery: "Eserlerim", settings: "Ayarlar" },
  }[lang];

  const bottomItems = [
    { icon: MessageSquare, label: LABELS.chat, href: "/chat" },
    { icon: Sparkles, label: LABELS.agents, href: "/industry" },
    // Image/video/music generation is a tab on the chat composer now, so
    // this slot points at the results instead of a second composer.
    { icon: GalleryHorizontal, label: LABELS.gallery, href: "/image/gallery" },
    { icon: User, label: LABELS.settings, href: "/settings" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <a href="#workspace-content" className="platform-skip">{tri(lang, "رفتن به محتوا", "Skip to content", "Zum Inhalt", "İçeriğe geç")}</a>
      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-3"
        style={{
          height: "calc(52px + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          ref={menuRef}
          onClick={() => setOpen(true)}
          aria-label={tri(lang, "باز کردن منو", "Open menu", "Menü öffnen", "Menüyü aç")}
          aria-expanded={open}
          aria-controls="mobile-workspace-menu"
          className="w-11 h-11 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text-primary)" }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/home" className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>AiFekr</Link>
        <div className="flex items-center gap-1"><button className="workspace-icon-button" style={{ background: "transparent", border: 0 }} aria-label={tri(lang, "جستجوی بخش‌های پلتفرم", "Search platform", "Plattform durchsuchen", "Platformda ara")} onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}><Search size={19}/></button><NotificationBell iconOnly dropUp={false} /></div>
      </header>

      {/* Drawer backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer (mobile sidebar) */}
      <div
        id="mobile-workspace-menu"
        ref={drawerRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={tri(lang, "منوی پلتفرم", "Workspace menu", "Arbeitsbereich-Menü", "Çalışma alanı menüsü")}
        aria-hidden={!open}
        dir={dir}
        className="md:hidden fixed top-0 bottom-0 z-50 w-[260px] transition-transform duration-300"
        style={{
          [dir === "rtl" ? "right" : "left"]: 0,
          transform: open ? "translateX(0)" : dir === "rtl" ? "translateX(100%)" : "translateX(-100%)",
          visibility: open ? "visible" : "hidden",
        }}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label={tri(lang, "بستن منو", "Close menu", "Menü schließen", "Menüyü kapat")}
          className="absolute top-3 z-10 w-11 h-11 flex items-center justify-center rounded-lg"
          style={{
            [dir === "rtl" ? "left" : "right"]: 8,
            background: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        >
          <X className="w-4 h-4" />
        </button>
        <div className="h-full">{sidebar}</div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:h-full">{sidebar}</div>

      {/* Main content */}
      {/* Business pages (CEO/SEO/Social/...) each render their own header row
          with a secondary action button pushed to the flex "end" side, which
          in RTL lands on the same left corner as the floating search trigger
          below — pt-14 (56px) wasn't enough vertical clearance to keep them
          from visually touching. Bumped to pt-20 (80px) and the trigger
          nudged down to top-4 so there's a real gap between them regardless
          of how tall a given page's own header happens to be. */}
      {/* Chat manages its own internal scroll region (header + scrollable
          messages + docked input, all sized via h-full) — letting `main`
          also scroll nested it inside another scroll container, which is
          what pushed the input bar and header off-screen on mobile. Every
          other page still relies on `main` itself scrolling. */}
      <main id="workspace-content" ref={mainRef} tabIndex={-1} className={`platform-main flex-1 pt-[calc(52px+env(safe-area-inset-top))] pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 relative ${isChatPage ? "overflow-hidden md:pt-0" : "overflow-y-auto overscroll-y-contain md:pt-0"}`}>
        {/* /chat renders its own compact search icon inline next to its header
            controls (see ChatInterface.tsx) — the floating trigger would sit
            directly above that row and read as a redundant, disconnected line. */}
        {!isChatPage && <WorkspaceHeader/>}
        <CommandPalette hideTrigger />
        {!isChatPage && <WorkspaceGuide/>}
        <div className={isChatPage ? "h-full min-w-0" : "workspace-module-content"}>{children}</div>
      </main>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around"
        style={{
          height: "calc(56px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "var(--surface-1)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {bottomItems.map(({ icon: Icon, label, href }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            onClick={() => setOpen(false)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5"
            style={{ color: isActive(href) ? "var(--primary)" : "var(--text-muted)" }}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
