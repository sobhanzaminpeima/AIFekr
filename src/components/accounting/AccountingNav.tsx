"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Receipt, Landmark, BookOpen, Bot,
  Wallet, CalendarClock, FileSpreadsheet, Lock,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

/**
 * Shared navigation for the accounting module, rendered once by
 * accounting/layout.tsx (not per-page anymore — see that file's comment for
 * why it moved).
 *
 * On a phone this is still the horizontal scrolling pill row it always was
 * (nine tabs don't fit a narrow screen any other way). At desktop width it
 * becomes a persistent left/right sidebar instead: a QA pass found the
 * horizontal bar meant an admin had to scroll sideways to even see whether
 * "Close period" or "Finance assistant" existed, and a sidebar shows all
 * nine section names at once with no discovery cost — the standard pattern
 * every desktop accounting product (QuickBooks, Xero) already uses.
 */
export default function AccountingNav() {
  const { lang } = useTranslation();
  const pathname = usePathname();
  const isFa = lang === "fa";

  const links = [
    { href: "/accounting", icon: LayoutDashboard, label: tri(lang, "داشبورد", "Dashboard", "Übersicht") },
    { href: "/accounting/expenses", icon: Receipt, label: tri(lang, "هزینه‌ها", "Expenses", "Ausgaben") },
    { href: "/accounting/bank", icon: Landmark, label: tri(lang, "بانک", "Bank", "Bank") },
    { href: "/accounting/ledger-setup", icon: BookOpen, label: tri(lang, "دفتر حساب‌ها", "Chart of accounts", "Kontenplan") },
    { href: "/accounting/owner-statements", icon: FileSpreadsheet, label: tri(lang, "تسویه مالک", "Owner statements", "Eigentümerabrechnung") },
    { href: "/accounting/payroll", icon: Wallet, label: tri(lang, "حقوق و دستمزد", "Payroll", "Gehaltsabrechnung") },
    { href: "/accounting/automation", icon: CalendarClock, label: tri(lang, "گزارش‌های زمان‌بندی‌شده", "Scheduled reports", "Geplante Berichte") },
    { href: "/accounting/close-period", icon: Lock, label: tri(lang, "بستن دوره", "Close period", "Periodenabschluss") },
    { href: "/accounting/assistant", icon: Bot, label: tri(lang, "دستیار مالی", "Finance assistant", "Finanzassistent") },
  ];

  // `/accounting` is a prefix of every other href, so it only matches exactly.
  const isActive = (href: string) =>
    href === "/accounting" ? pathname === "/accounting" : pathname.startsWith(href);

  return (
    <nav
      aria-label={tri(lang, "بخش‌های حسابداری", "Accounting sections", "Buchhaltungsbereiche")}
      // Mobile: horizontal, scrolls inside itself rather than widening the
      // page. Desktop (md+): a vertical sticky sidebar, full labels, no
      // scrolling needed to see every section.
      className="flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0 md:w-56 md:flex-shrink-0 md:sticky md:top-20 md:self-start"
      style={{ scrollbarWidth: "thin" }}
    >
      {links.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap flex-shrink-0 md:flex-shrink md:w-full transition-colors"
            style={{
              background: active ? "var(--primary)" : "var(--surface-2)",
              color: active ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
              justifyContent: "flex-start",
              textAlign: isFa ? "right" : "left",
            }}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
