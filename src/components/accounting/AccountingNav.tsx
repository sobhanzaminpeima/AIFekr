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
 * Shared navigation for the accounting module.
 *
 * It used to be a row of unlabelled pills at the very BOTTOM of /accounting
 * only — so you had to scroll the whole dashboard to find the nine sections,
 * and once you opened one there was no way to move between them without going
 * back. This sits at the top of every accounting page and marks where you are.
 */
export default function AccountingNav() {
  const { lang } = useTranslation();
  const pathname = usePathname();

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
      // Scrolls inside itself on a phone rather than widening the page.
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {links.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors"
            style={{
              background: active ? "var(--primary)" : "var(--surface-2)",
              color: active ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
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
