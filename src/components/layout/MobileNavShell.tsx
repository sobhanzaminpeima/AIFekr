"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Sparkles, Image as ImageIcon, User } from "lucide-react";

export default function MobileNavShell({
  sidebar, children, lang,
}: { sidebar: React.ReactNode; children: React.ReactNode; lang: "fa" | "en" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dir = lang === "en" ? "ltr" : "rtl";

  const bottomItems = lang === "en"
    ? [
        { icon: MessageSquare, label: "Chat", href: "/chat" },
        { icon: Sparkles, label: "Agents", href: "/industry" },
        { icon: ImageIcon, label: "Create", href: "/image/generate" },
        { icon: User, label: "Settings", href: "/settings" },
      ]
    : [
        { icon: MessageSquare, label: "چت", href: "/chat" },
        { icon: Sparkles, label: "ایجنت‌ها", href: "/industry" },
        { icon: ImageIcon, label: "ساخت", href: "/image/generate" },
        { icon: User, label: "تنظیمات", href: "/settings" },
      ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
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
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text-primary)" }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>AiFekr</span>
        <div className="w-9" />
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
        dir={dir}
        className="md:hidden fixed top-0 bottom-0 z-50 w-[220px] transition-transform duration-300"
        style={{
          [dir === "rtl" ? "right" : "left"]: 0,
          transform: open ? "translateX(0)" : dir === "rtl" ? "translateX(100%)" : "translateX(-100%)",
        }}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg"
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
      <main className="flex-1 overflow-y-auto pt-[calc(52px+env(safe-area-inset-top))] pb-[calc(56px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
        {children}
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
