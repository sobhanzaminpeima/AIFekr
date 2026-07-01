"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare, Image as ImageIcon, Video, Music, GalleryHorizontal,
  ChevronDown, ChevronLeft, Settings, LogOut, Wallet, Crown,
  Briefcase, TrendingUp, ShoppingCart, Calculator, Salad,
  GraduationCap, Stethoscope, Languages, ChefHat, Dumbbell, Plane, Code2,
  Plus, History, HeartPulse, Search, Share2, Globe, Factory, Users,
} from "lucide-react";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { useTranslation } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/jalali";

interface SidebarProps {
  user?: { name?: string | null; credits: number; plan: string } | null;
  conversations?: { id: string; title?: string | null; updatedAt: string }[];
  onNewChat?: () => void;
}

const planColors: Record<string, string> = {
  FREE: "#71717a",
  BASIC: "#3b82f6",
  PRO: "#ea580c",
  TEAM: "#8b5cf6",
};

const planNamesFA: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };
const planNamesEN: Record<string, string> = { FREE: "Free", BASIC: "Basic", PRO: "Pro", TEAM: "Team" };

export default function Sidebar({ user, conversations = [], onNewChat }: SidebarProps) {
  const pathname = usePathname();
  const { t, lang } = useTranslation();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [assistantsOpen, setAssistantsOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const planNames = lang === "en" ? planNamesEN : planNamesFA;

  const tools = lang === "en"
    ? [
        { icon: Briefcase, label: "Business Ideas", href: "/tools/business-ideas" },
        { icon: TrendingUp, label: "Market Analysis", href: "/tools/trading" },
        { icon: ShoppingCart, label: "Dropshipping", href: "/tools/drop-shipping" },
        { icon: Calculator, label: "Math Solver", href: "/tools/math" },
        { icon: Salad, label: "Diet Plan", href: "/tools/healthy-diet" },
      ]
    : [
        { icon: Briefcase, label: "ایده کسب‌وکار", href: "/tools/business-ideas" },
        { icon: TrendingUp, label: "تحلیل بازار", href: "/tools/trading" },
        { icon: ShoppingCart, label: "دراپشیپینگ", href: "/tools/drop-shipping" },
        { icon: Calculator, label: "حل ریاضیات", href: "/tools/math" },
        { icon: Salad, label: "برنامه غذایی", href: "/tools/healthy-diet" },
      ];

  const assistants = lang === "en"
    ? [
        { icon: GraduationCap, label: "Teacher", href: "/assistants/teacher" },
        { icon: Stethoscope, label: "Doctor", href: "/assistants/doctor" },
        { icon: Languages, label: "Translator", href: "/assistants/translator" },
        { icon: ChefHat, label: "Chef", href: "/assistants/cooking" },
        { icon: Dumbbell, label: "Fitness Coach", href: "/assistants/fitness-coach" },
        { icon: Plane, label: "Travel Agent", href: "/assistants/travel-agent" },
        { icon: Code2, label: "Code Expert", href: "/assistants/code-expert" },
      ]
    : [
        { icon: GraduationCap, label: "معلم", href: "/assistants/teacher" },
        { icon: Stethoscope, label: "پزشک", href: "/assistants/doctor" },
        { icon: Languages, label: "مترجم", href: "/assistants/translator" },
        { icon: ChefHat, label: "آشپز", href: "/assistants/cooking" },
        { icon: Dumbbell, label: "مربی بدنسازی", href: "/assistants/fitness-coach" },
        { icon: Plane, label: "مشاور سفر", href: "/assistants/travel-agent" },
        { icon: Code2, label: "کارشناس کد", href: "/assistants/code-expert" },
      ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside
      className="flex flex-col h-full w-[220px] flex-shrink-0"
      style={{ background: "var(--surface-1)", borderLeft: lang === "en" ? "none" : "1px solid var(--border)", borderRight: lang === "en" ? "1px solid var(--border)" : "none" }}
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
        <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>AiFekr</span>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "var(--primary)", color: "white" }}
        >
          <Plus className="w-4 h-4" />
          {lang === "en" ? "New Chat" : "گفتگوی جدید"}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        <NavItem icon={MessageSquare} label={t.nav.chat} href="/chat" active={isActive("/chat")} />
        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
        <NavItem icon={ImageIcon} label={t.nav.image} href="/image/generate" active={isActive("/image")} />
        <NavItem icon={Video} label={t.nav.video} href="/video/generate" active={isActive("/video")} />
        <NavItem icon={Music} label={t.nav.music} href="/music/generate" active={isActive("/music")} />
        <NavItem icon={GalleryHorizontal} label={t.nav.gallery} href="/image/gallery" active={isActive("/image/gallery")} />
        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

        {/* Tools */}
        <button
          onClick={() => setToolsOpen(!toolsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            {t.nav.tools}
          </span>
          {toolsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {toolsOpen && (
          <div className="pr-4 space-y-0.5">
            {tools.map((tool) => (
              <NavItem key={tool.href} icon={tool.icon} label={tool.label} href={tool.href} active={isActive(tool.href)} small />
            ))}
          </div>
        )}

        {/* Assistants */}
        <button
          onClick={() => setAssistantsOpen(!assistantsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            {t.nav.assistants}
          </span>
          {assistantsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {assistantsOpen && (
          <div className="pr-4 space-y-0.5">
            {assistants.map((a) => (
              <NavItem key={a.href} icon={a.icon} label={a.label} href={a.href} active={isActive(a.href)} small />
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

        {/* AI Business Features */}
        <NavItem icon={HeartPulse} label={t.nav.businessDoctor} href="/business-doctor" active={isActive("/business-doctor")} />
        <NavItem icon={Crown} label={t.nav.ceoAdvisor} href="/ceo" active={isActive("/ceo")} />
        <NavItem icon={Search} label={t.nav.seoWorkspace} href="/seo" active={isActive("/seo")} />
        <NavItem icon={Share2} label={t.nav.socialMedia} href="/social" active={isActive("/social")} />
        <NavItem icon={Globe} label={t.nav.websiteDesigner} href="/website-designer" active={isActive("/website-designer")} />
        <NavItem icon={Factory} label={t.nav.industryPacks} href="/industry" active={isActive("/industry")} />
        <NavItem icon={Users} label={t.nav.meetingRoom} href="/meeting" active={isActive("/meeting")} />

        {/* Conversation history */}
        {conversations.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
            <div className="px-3 py-1 flex items-center gap-2">
              <History className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.nav.history}</span>
            </div>
            {conversations.slice(0, 10).map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className="flex items-center px-3 py-1.5 rounded-lg text-xs truncate transition-all"
                style={{
                  color: pathname === `/chat/${c.id}` ? "var(--primary)" : "var(--text-secondary)",
                  background: pathname === `/chat/${c.id}` ? "rgba(234,88,12,0.1)" : "transparent",
                }}
              >
                <MessageSquare className="w-3 h-3 ml-2 flex-shrink-0" />
                <span className="truncate">{c.title || (lang === "en" ? "Untitled Chat" : "گفتگوی بی‌نام")}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      {user && (
        <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {formatNumber(user.credits)} {lang === "en" ? "credits" : "اعتبار"}
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: planColors[user.plan] + "22", color: planColors[user.plan] }}>
              {planNames[user.plan]}
            </span>
          </div>

          {user.plan === "FREE" && (
            <Link
              href="/plans"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)", border: "1px solid rgba(234,88,12,0.3)" }}
            >
              <Crown className="w-4 h-4" />
              {t.nav.upgrade}
            </Link>
          )}

          <div className="flex gap-2">
            <LanguageSwitcher className="flex-1 justify-center" />
            <CurrencySelector className="flex-1 justify-center" />
          </div>

          <div className="flex gap-2">
            <Link
              href="/settings"
              className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs transition-all"
              style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}
            >
              <Settings className="w-3.5 h-3.5" />
              {t.nav.settings}
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs transition-all"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.nav.logout}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function NavItem({
  icon: Icon, label, href, active, small = false,
}: { icon: React.ElementType; label: string; href: string; active: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 rounded-xl text-sm font-medium transition-all ${small ? "py-1.5" : "py-2"}`}
      style={{
        background: active ? "rgba(234,88,12,0.12)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-secondary)",
      }}
    >
      <Icon className={small ? "w-3.5 h-3.5" : "w-4 h-4"} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
