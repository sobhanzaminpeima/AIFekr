"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, DollarSign, Bot, Wrench,
  Activity, Settings, LogOut, Sparkles, Shield, MessageSquare,
  HelpCircle, Package, UserCog, Database, Cpu, Contact,
  ChevronDown, Factory, Building2, Tag, Clock, Globe,
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  {
    label: null,
    items: [
      { icon: LayoutDashboard, label: "داشبورد", href: "/admin/dashboard" },
    ],
  },
  {
    label: "مدیریت کاربران",
    items: [
      { icon: Users, label: "کاربران", href: "/admin/users" },
      { icon: UserCog, label: "مدیران سیستم", href: "/admin/admins" },
      { icon: Contact, label: "CRM", href: "/admin/crm" },
    ],
  },
  {
    label: "مدیریت محتوا",
    items: [
      { icon: MessageSquare, label: "مدیریت چت‌ها", href: "/admin/chats" },
      { icon: Globe, label: "وبسایت‌های تولیدشده", href: "/admin/generated-websites" },
      { icon: HelpCircle, label: "سوالات آماده", href: "/admin/prompts" },
    ],
  },
  {
    label: "هوش مصنوعی",
    items: [
      { icon: Cpu, label: "مدیریت LLM", href: "/admin/llm" },
      { icon: Wrench, label: "ابزارها", href: "/admin/tools" },
    ],
  },
  {
    label: "بیزنس و صنعت",
    items: [
      { icon: Factory, label: "بسته‌های صنعتی", href: "/admin/industry-packs" },
      { icon: Building2, label: "شرکت‌ها", href: "/admin/companies" },
      { icon: Tag, label: "دسته‌بندی‌ها", href: "/admin/categories" },
      { icon: Clock, label: "مدیریت انقضا", href: "/admin/subscriptions" },
    ],
  },
  {
    label: "مالی و اشتراک",
    items: [
      { icon: Package, label: "مدیریت پکیج", href: "/admin/packages" },
      { icon: CreditCard, label: "اشتراک‌ها", href: "/admin/subscriptions" },
      { icon: DollarSign, label: "مدیریت مالی", href: "/admin/financial" },
    ],
  },
  {
    label: "سیستم",
    items: [
      { icon: Settings, label: "تنظیمات سایت", href: "/admin/settings" },
      { icon: Database, label: "مدیریت سیستم", href: "/admin/system" },
      { icon: Activity, label: "لاگ‌ها", href: "/admin/logs" },
    ],
  },
];

const roleNames: Record<string, string> = {
  ADMIN: "ادمین",
  SUPER_ADMIN: "سوپر ادمین",
  MODERATOR: "مدیر محتوا",
};

export default function AdminSidebar({ adminName, role }: { adminName: string; role: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 transition-all duration-300"
      style={{
        width: collapsed ? "60px" : "220px",
        background: "#0d0d0d",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div className="p-3 flex items-center gap-2 justify-between" style={{ borderBottom: "1px solid var(--border)", minHeight: "60px" }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: "var(--primary)" }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>هوشمند AI</div>
              <div className="text-xs" style={{ color: "var(--primary)" }}>پنل مدیریت</div>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
          <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? "rotate-90" : "-rotate-90"}`} />
        </button>
      </div>

      {/* Admin info */}
      {!collapsed && (
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface-2)" }}>
              <Shield className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{adminName}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{roleNames[role] || role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <div className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      color: active ? "var(--primary)" : "var(--text-secondary)",
                      background: active ? "rgba(234,88,12,0.12)" : "transparent",
                      justifyContent: collapsed ? "center" : undefined,
                    }}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
        <Link
          href="/chat"
          title={collapsed ? "بازگشت به اپ" : undefined}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-all"
          style={{ color: "var(--text-secondary)", background: "var(--surface-2)", justifyContent: collapsed ? "center" : undefined }}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "بازگشت به اپ"}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? "خروج" : undefined}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-all"
          style={{ color: "var(--danger)", background: "rgba(239,68,68,0.1)", justifyContent: collapsed ? "center" : undefined }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "خروج"}
        </button>
      </div>
    </aside>
  );
}
