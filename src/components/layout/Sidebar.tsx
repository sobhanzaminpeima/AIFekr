"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Image as ImageIcon, Video, Music, GalleryHorizontal,
  ChevronDown, ChevronLeft, Settings, LogOut, Wallet, Crown,
  Briefcase, TrendingUp, ShoppingCart, Calculator, Salad,
  GraduationCap, Stethoscope, Languages, ChefHat, Dumbbell, Plane, Code2,
  Plus, History, HeartPulse, Search, Share2, Globe, Factory, Users,
  FolderOpen, Folder, FolderPlus, X, Check, MoreHorizontal, Trash2, ArrowLeft, Zap, Rocket, Gift, Sparkles, FlaskConical, Phone, Handshake,
} from "lucide-react";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import CurrencySelector from "@/components/ui/CurrencySelector";
import NotificationBell from "@/components/layout/NotificationBell";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { DEPARTMENTS as TEAM_DEPARTMENTS } from "@/lib/team/identity";
import { formatNumber } from "@/lib/utils/jalali";

interface Project { id: string; name: string; color: string; icon: string; conversationCount: number; }

interface SidebarProps {
  user?: { name?: string | null; credits: number; plan: string; industryPackId?: string | null } | null;
  conversations?: { id: string; title?: string | null; updatedAt: string; projectId?: string | null }[];
  onNewChat?: () => void;
}

const planColors: Record<string, string> = { FREE: "#71717a", BASIC: "#3b82f6", PRO: "#ea580c", TEAM: "#8b5cf6" };
const planNamesFA: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };
const planNamesEN: Record<string, string> = { FREE: "Free", BASIC: "Basic", PRO: "Pro", TEAM: "Team" };
const planNamesDE: Record<string, string> = { FREE: "Kostenlos", BASIC: "Basis", PRO: "Pro", TEAM: "Team" };
const PROJECT_COLORS = ["#ea580c", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6b7280"];

/**
 * The business area, grouped by DEPARTMENT rather than by kind of tool.
 *
 * It used to be eleven flat destinations under one "My Business" heading,
 * ordered by which tool was built first — so an estate agent looking for
 * today's leads had to read all eleven and guess. These are the same eleven
 * destinations, nothing added or removed, arranged the way the work is
 * actually divided in an agency.
 *
 * Each department carries a fixed colour so it stays recognisable wherever it
 * appears. `items` takes the translation dictionary because these labels
 * already exist there in all three languages — the department names are the
 * only new strings, and they are written out inline below.
 */
const DEPARTMENTS: {
  key: string;
  color: string;
  tint: string;
  icon: React.ElementType;
  label: (lang: Lang) => string;
  items: (t: ReturnType<typeof useTranslation>["t"]) => { icon: React.ElementType; label: string; href: string }[];
}[] = [
  {
    key: "sales",
    color: TEAM_DEPARTMENTS.sales.color,
    tint: TEAM_DEPARTMENTS.sales.tint,
    icon: Handshake,
    label: TEAM_DEPARTMENTS.sales.label,
    items: (t) => [
      { icon: Briefcase, label: t.nav.crm, href: "/crm" },
      { icon: Handshake, label: t.nav.salesAgent, href: "/sales" },
      { icon: Phone, label: t.nav.voiceAgent, href: "/voice-agent" },
      { icon: Factory, label: t.nav.industryPacks, href: "/industry" },
    ],
  },
  {
    key: "marketing",
    color: TEAM_DEPARTMENTS.marketing.color,
    tint: TEAM_DEPARTMENTS.marketing.tint,
    icon: Share2,
    label: TEAM_DEPARTMENTS.marketing.label,
    items: (t) => [
      { icon: Share2, label: t.nav.socialMedia, href: "/social" },
      { icon: Search, label: t.nav.seoWorkspace, href: "/seo" },
      { icon: Globe, label: t.nav.websiteDesigner, href: "/website-designer" },
    ],
  },
  {
    key: "finance",
    color: TEAM_DEPARTMENTS.finance.color,
    tint: TEAM_DEPARTMENTS.finance.tint,
    icon: Calculator,
    label: TEAM_DEPARTMENTS.finance.label,
    items: (t) => [
      { icon: Calculator, label: t.nav.accounting, href: "/accounting" },
    ],
  },
  {
    key: "strategy",
    color: TEAM_DEPARTMENTS.strategy.color,
    tint: TEAM_DEPARTMENTS.strategy.tint,
    icon: Crown,
    label: TEAM_DEPARTMENTS.strategy.label,
    items: (t) => [
      { icon: Crown, label: t.nav.ceoAdvisor, href: "/ceo" },
      { icon: HeartPulse, label: t.nav.businessDoctor, href: "/business-doctor" },
      { icon: Users, label: t.nav.meetingRoom, href: "/meeting" },
    ],
  },
];

export default function Sidebar({ user, conversations = [], onNewChat }: SidebarProps) {
  const pathname = usePathname();
  const { t, lang } = useTranslation();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  // Design Director phase 2 — the eleven business destinations are grouped into
  // four departments. A department opens when the page you are on lives inside
  // it, so you always see where you are without hunting; the rest stay closed
  // so the list is four lines instead of eleven.
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#ea580c");
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [convMenuOpen, setConvMenuOpen] = useState<string | null>(null);

  const router = useRouter();
  const hasPack = !!user?.industryPackId;

  useEffect(() => { loadProjects(); }, []);

  // Close any open dropdown when the user clicks outside of it
  useEffect(() => {
    if (!projectMenuOpen && !convMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-dropdown-root]")) return;
      setProjectMenuOpen(null);
      setConvMenuOpen(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [projectMenuOpen, convMenuOpen]);

  async function moveConvToProject(convId: string, projectId: string) {
    setConvMenuOpen(null);
    try {
      await fetch(`/api/projects/${projectId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      loadProjects();
      router.refresh();
    } catch {}
  }

  async function removeConvFromProject(convId: string, projectId: string) {
    setConvMenuOpen(null);
    try {
      await fetch(`/api/projects/${projectId}/conversations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      loadProjects();
      router.refresh();
    } catch {}
  }

  async function deleteConversation(convId: string) {
    setConvMenuOpen(null);
    if (!confirm(tri(lang, "این گفتگو برای همیشه حذف بشه؟ این عمل قابل بازگشت نیست.", "Delete this chat permanently? This can't be undone.", "Diesen Chat dauerhaft löschen? Das kann nicht rückgängig gemacht werden."))) return;
    try {
      await fetch(`/api/chat/history/${convId}`, { method: "DELETE" });
      loadProjects();
      if (pathname === `/chat/${convId}`) router.push("/chat");
      router.refresh();
    } catch {}
  }

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) { const d = await res.json(); setProjects(d.projects || []); }
    } catch {}
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName, color: newProjectColor }),
      });
      if (res.ok) { setCreatingProject(false); setNewProjectName(""); loadProjects(); }
    } catch {}
  }

  async function deleteProject(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((p) => p.filter((x) => x.id !== id));
    setProjectMenuOpen(null);
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const planNames = lang === "fa" ? planNamesFA : lang === "de" ? planNamesDE : planNamesEN;

  const tools = [
    { icon: Briefcase, label: tri(lang, "ایده کسب‌وکار", "Business Ideas", "Geschäftsideen"), href: "/tools/business-ideas" },
    { icon: TrendingUp, label: tri(lang, "تحلیل بازار", "Market Analysis", "Marktanalyse"), href: "/tools/trading" },
    { icon: ShoppingCart, label: tri(lang, "دراپشیپینگ", "Dropshipping", "Dropshipping"), href: "/tools/drop-shipping" },
    { icon: Calculator, label: tri(lang, "حل ریاضیات", "Math Solver", "Mathe-Löser"), href: "/tools/math" },
    { icon: Salad, label: tri(lang, "برنامه غذایی", "Diet Plan", "Ernährungsplan"), href: "/tools/healthy-diet" },
    { icon: FlaskConical, label: tri(lang, "امتحان AI رایگان (آزمایشی)", "Try Free AI (Experimental)", "Kostenlose KI testen (experimentell)"), href: "/tools/try-free-ai" },
  ];

  const assistants = [
    { icon: GraduationCap, label: tri(lang, "معلم", "Teacher", "Lehrer"), href: "/assistants/teacher" },
    { icon: Stethoscope, label: tri(lang, "پزشک", "Doctor", "Arzt"), href: "/assistants/doctor" },
    { icon: Languages, label: tri(lang, "مترجم", "Translator", "Übersetzer"), href: "/assistants/translator" },
    { icon: ChefHat, label: tri(lang, "آشپز", "Chef", "Koch"), href: "/assistants/cooking" },
    { icon: Dumbbell, label: tri(lang, "مربی بدنسازی", "Fitness Coach", "Fitnesstrainer"), href: "/assistants/fitness-coach" },
    { icon: Plane, label: tri(lang, "مشاور سفر", "Travel Agent", "Reiseberater"), href: "/assistants/travel-agent" },
    { icon: Code2, label: tri(lang, "کارشناس کد", "Code Expert", "Code-Experte"), href: "/assistants/code-expert" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const freeConvs = conversations.filter((c) => !c.projectId);
  const getProjectConvs = (pid: string) => conversations.filter((c) => c.projectId === pid);

  return (
    <aside className="flex flex-col h-full w-[220px] flex-shrink-0"
      style={{ background: "var(--surface-1)", borderLeft: lang === "fa" ? "1px solid var(--border)" : "none", borderRight: lang === "fa" ? "none" : "1px solid var(--border)" }}>

      {/* Logo */}
      <div className="p-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <Image src="/logo.svg" alt="AiFekr" width={32} height={32} className="rounded-lg" />
        <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>AiFekr</span>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button onClick={() => { onNewChat?.(); router.push("/chat"); router.refresh(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--primary)", color: "white" }}>
          <Plus className="w-4 h-4" />
          {tri(lang, "گفتگوی جدید", "New Chat", "Neuer Chat")}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        <NavItem icon={LayoutDashboard} label={tri(lang, "خانه", "Home", "Startseite")} href="/home" active={isActive("/home")} />
        <NavItem icon={MessageSquare} label={t.nav.chat} href="/chat" active={isActive("/chat")} />

        <NavSection label={tri(lang, "ساخت محتوا", "Create", "Erstellen")} />
        <NavItem icon={Sparkles} label={tri(lang, "ایجنت‌های من", "My Agents", "Meine Agenten")} href="/agents" active={isActive("/agents")} />
        <NavItem icon={ImageIcon} label={t.nav.image} href="/image/generate" active={isActive("/image")} />
        <NavItem icon={Video} label={t.nav.video} href="/video/generate" active={isActive("/video")} />
        <NavItem icon={Music} label={t.nav.music} href="/music/generate" active={isActive("/music")} />
        <NavItem icon={GalleryHorizontal} label={t.nav.gallery} href="/image/gallery" active={isActive("/image/gallery")} />
        <NavItem icon={Rocket} label={t.nav.startupBuilder} href="/startup/builder" active={isActive("/startup")} />

        {/* Tools */}
        <button onClick={() => setToolsOpen(!toolsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-2 min-w-0"><Briefcase className="w-4 h-4 flex-shrink-0" /><span className="truncate">{t.nav.tools}</span></span>
          {toolsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {toolsOpen && <div className="pr-4 space-y-0.5">{tools.map((t) => <NavItem key={t.href} icon={t.icon} label={t.label} href={t.href} active={isActive(t.href)} small />)}</div>}

        {/* Assistants */}
        <button onClick={() => setAssistantsOpen(!assistantsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-2 min-w-0"><GraduationCap className="w-4 h-4 flex-shrink-0" /><span className="truncate">{t.nav.assistants}</span></span>
          {assistantsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {assistantsOpen && <div className="pr-4 space-y-0.5">{assistants.map((a) => <NavItem key={a.href} icon={a.icon} label={a.label} href={a.href} active={isActive(a.href)} small />)}</div>}

        {/* ── BUSINESS SECTION ─────────────────── */}
        {hasPack ? (
          <>
            <NavSection label={tri(lang, "کسب‌وکار من", "My Business", "Mein Unternehmen")} />
            {DEPARTMENTS.map((dept) => {
              const items = dept.items(t);
              const hasCurrent = items.some((i) => isActive(i.href));
              // Explicit open/closed wins; otherwise the department containing
              // the current page is the one that is open.
              const open = openDept === null ? hasCurrent : openDept === dept.key;
              return (
                <div key={dept.key}>
                  <button
                    onClick={() => setOpenDept(open ? "" : dept.key)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ color: hasCurrent ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {/* A tinted tile rather than a bare icon: it gives the
                          department a consistent mark that the home page reuses
                          on the same team's activity rows. */}
                      <span
                        className="w-6 h-6 rounded-lg grid place-items-center flex-shrink-0 transition-colors"
                        style={{ background: open || hasCurrent ? dept.tint : "var(--surface-2)" }}
                      >
                        <dept.icon className="w-3.5 h-3.5" style={{ color: dept.color }} />
                      </span>
                      <span className="truncate">{dept.label(lang)}</span>
                    </span>
                    <ChevronDown
                      className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                      style={{ transform: open ? "none" : "rotate(-90deg)", color: "var(--text-muted)" }}
                    />
                  </button>
                  {open && (
                    /* A guide line down the group ties the children to their
                       heading, so an open department reads as one block. */
                    <div
                      className="space-y-0.5 ms-[23px] ps-2"
                      style={{ borderInlineStart: `1px solid ${dept.tint}` }}
                    >
                      {items.map((i) => (
                        <NavItem key={i.href} icon={i.icon} label={i.label} href={i.href} active={isActive(i.href)} accent={dept.color} small />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* No pack - show CTA */
          <Link href="/industry"
            className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all mx-1 mb-1"
            style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.15), rgba(249,115,22,0.1))", border: "1px solid rgba(234,88,12,0.3)", color: "#ea580c" }}>
            <Zap className="w-4 h-4 flex-shrink-0" />
            <div className="text-right leading-tight">
              <div className="font-semibold text-xs">{tri(lang, "رشد کسب‌وکارت", "Grow Your Business", "Ihr Geschäft ausbauen")}</div>
              <div className="text-xs opacity-70 mt-0.5">{tri(lang, "بسته‌های ایجنت AI", "AI Agent Packs", "KI-Agenten-Pakete")}</div>
            </div>
            <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0 mr-auto" />
          </Link>
        )}

        {/* ── PROJECTS ─────────────────────── */}
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <div className="flex items-center justify-between px-3 py-1.5">
          <button onClick={() => setProjectsOpen(!projectsOpen)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}>
            <FolderOpen className="w-4 h-4" />
            {tri(lang, "پروژه‌ها", "Projects", "Projekte")}
            {projectsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setCreatingProject(true)} title={tri(lang, "پروژه جدید", "New project", "Neues Projekt")}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {creatingProject && (
          <div className="mx-2 mb-1 p-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <input autoFocus value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createProject(); if (e.key === "Escape") setCreatingProject(false); }}
              placeholder={tri(lang, "نام پروژه...", "Project name…", "Projektname…")}
              className="w-full bg-transparent text-xs outline-none mb-2" style={{ color: "var(--text-primary)" }} />
            <div className="flex gap-1 mb-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setNewProjectColor(c)}
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: c, outline: newProjectColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={createProject} className="flex-1 flex items-center justify-center py-1 rounded-lg text-xs text-white" style={{ background: "var(--primary)" }}>
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => { setCreatingProject(false); setNewProjectName(""); }}
                className="flex-1 flex items-center justify-center py-1 rounded-lg text-xs" style={{ background: "var(--surface-0)" }}>
                <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          </div>
        )}

        {projectsOpen && projects.map((project) => {
          const pConvs = getProjectConvs(project.id);
          const isExpanded = expandedProject === project.id;
          return (
            <div key={project.id}>
              <div className="flex items-center gap-1 px-2">
                <button onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}>
                  {isExpanded
                    ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: project.color }} />
                    : <Folder className="w-3.5 h-3.5 flex-shrink-0" style={{ color: project.color }} />}
                  <span className="truncate flex-1">{project.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: project.color + "22", color: project.color, fontSize: "10px" }}>
                    {pConvs.length || project.conversationCount}
                  </span>
                </button>
                <div className="relative" data-dropdown-root>
                  <button onClick={() => setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id)}
                    className="p-1 rounded-lg hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                  {projectMenuOpen === project.id && (
                    <div className="absolute left-0 top-6 z-50 rounded-xl shadow-xl overflow-hidden"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", minWidth: "120px" }}>
                      <button onClick={() => deleteProject(project.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-white/5">
                        <Trash2 className="w-3 h-3" />
                        {tri(lang, "حذف", "Delete", "Löschen")}
                      </button>
                      <button onClick={() => {
                        const newName = prompt(tri(lang, "نام جدید:", "New name:", "Neuer Name:"), project.name);
                        if (newName) fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) }).then(loadProjects);
                        setProjectMenuOpen(null);
                      }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                        <Settings className="w-3 h-3" />
                        {tri(lang, "تغییر نام", "Rename", "Umbenennen")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="pr-5 space-y-0.5 mb-1">
                  <Link href={`/chat?project=${project.id}`}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs w-full"
                    style={{ color: project.color, background: project.color + "15" }}>
                    <Plus className="w-3 h-3" />
                    {tri(lang, "چت جدید در پروژه", "New chat in project", "Neuer Chat im Projekt")}
                  </Link>
                  {pConvs.slice(0, 8).map((c) => (
                    <div key={c.id} className="relative flex items-center group" data-dropdown-root>
                      <Link href={`/chat/${c.id}`}
                        className="flex-1 flex items-center px-2 py-1.5 rounded-lg text-xs truncate min-w-0"
                        style={{ color: pathname === `/chat/${c.id}` ? project.color : "var(--text-secondary)", background: pathname === `/chat/${c.id}` ? project.color + "15" : "transparent" }}>
                        <MessageSquare className="w-3 h-3 ml-1.5 flex-shrink-0" style={{ color: project.color, opacity: 0.7 }} />
                        <span className="truncate">{c.title || tri(lang, "بی‌نام", "Untitled", "Ohne Titel")}</span>
                      </Link>
                      <button onClick={() => setConvMenuOpen(convMenuOpen === c.id ? null : c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded flex-shrink-0"
                        style={{ color: "var(--text-muted)" }}>
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                      {convMenuOpen === c.id && (
                        <div className="absolute left-0 top-8 z-50 rounded-xl shadow-xl overflow-hidden"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", minWidth: "140px" }}>
                          <button onClick={() => removeConvFromProject(c.id, project.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                            style={{ color: "var(--text-secondary)" }}>
                            <X className="w-3 h-3" />
                            {tri(lang, "خارج از پروژه", "Remove from project", "Aus Projekt entfernen")}
                          </button>
                          <button onClick={() => deleteConversation(c.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                            style={{ color: "#ef4444", borderTop: "1px solid var(--border)" }}>
                            <Trash2 className="w-3 h-3" />
                            {tri(lang, "حذف گفتگو", "Delete chat", "Chat löschen")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {pConvs.length === 0 && (
                    <p className="px-2 py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {tri(lang, "هنوز چتی ندارد", "No chats yet", "Noch keine Chats")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Free conversations */}
        {freeConvs.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
            <div className="px-3 py-1 flex items-center gap-2">
              <History className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.nav.history}</span>
            </div>
            {freeConvs.slice(0, 8).map((c) => (
              <div key={c.id} className="relative flex items-center group" data-dropdown-root>
                <Link href={`/chat/${c.id}`}
                  className="flex-1 flex items-center px-3 py-1.5 rounded-lg text-xs truncate min-w-0"
                  style={{ color: pathname === `/chat/${c.id}` ? "var(--primary)" : "var(--text-secondary)", background: pathname === `/chat/${c.id}` ? "rgba(234,88,12,0.1)" : "transparent" }}>
                  <MessageSquare className="w-3 h-3 ml-2 flex-shrink-0" />
                  <span className="truncate">{c.title || tri(lang, "گفتگوی بی‌نام", "Untitled Chat", "Chat ohne Titel")}</span>
                </Link>
                <button
                  onClick={() => setConvMenuOpen(convMenuOpen === c.id ? null : c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded flex-shrink-0 ml-1"
                  style={{ color: "var(--text-muted)" }}>
                  <MoreHorizontal className="w-3 h-3" />
                </button>
                {convMenuOpen === c.id && (
                  <div className="absolute left-0 top-8 z-50 rounded-xl shadow-xl overflow-hidden"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", minWidth: "160px" }}>
                    <div className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      {tri(lang, "انتقال به پروژه", "Move to project", "In Projekt verschieben")}
                    </div>
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {tri(lang, "پروژه‌ای ندارید", "No projects yet", "Noch keine Projekte")}
                      </div>
                    )}
                    {projects.map((p) => (
                      <button key={p.id} onClick={() => moveConvToProject(c.id, p.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                        style={{ color: "var(--text-secondary)" }}>
                        <Folder className="w-3 h-3 flex-shrink-0" style={{ color: p.color }} />
                        {p.name}
                      </button>
                    ))}
                    <button onClick={() => deleteConversation(c.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                      style={{ color: "#ef4444", borderTop: "1px solid var(--border)" }}>
                      <Trash2 className="w-3 h-3" />
                      {tri(lang, "حذف گفتگو", "Delete chat", "Chat löschen")}
                    </button>
                    <button onClick={() => setConvMenuOpen(null)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                      style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                      <X className="w-3 h-3" />
                      {tri(lang, "لغو", "Cancel", "Abbrechen")}
                    </button>
                  </div>
                )}
              </div>
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
                {formatNumber(user.credits, lang)} {tri(lang, "اعتبار", "credits", "Credits")}
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: planColors[user.plan] + "22", color: planColors[user.plan] }}>
              {planNames[user.plan]}
            </span>
          </div>
          {!hasPack && (
            <Link href="/industry" className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)", border: "1px solid rgba(234,88,12,0.3)" }}>
              <Crown className="w-4 h-4" />{tri(lang, "بسته‌های کسب‌وکار", "Business Plans", "Business-Pakete")}
            </Link>
          )}
          {user.plan === "FREE" && !hasPack && (
            <Link href="/plans" className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <Crown className="w-4 h-4" />{t.nav.upgrade}
            </Link>
          )}
          <Link href="/referral" className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
            <Gift className="w-4 h-4" />{tri(lang, "دعوت کن، اعتبار بگیر", "Invite & Earn", "Einladen & verdienen")}
          </Link>
          {/* JARVIS link temporarily disabled on the site per request — SSO route itself untouched. */}
          <div className="flex items-center justify-center gap-1.5">
            <NotificationBell iconOnly />
            <LanguageSwitcher iconOnly dropUp />
            <ThemeSwitcher iconOnly />
            <CurrencySelector iconOnly />
          </div>
          <div className="flex gap-2">
            <Link href="/settings" className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs"
              style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}>
              <Settings className="w-3.5 h-3.5" />{t.nav.settings}
            </Link>
            <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
              <LogOut className="w-3.5 h-3.5" />{t.nav.logout}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

/**
 * A section label. The sidebar previously carried 21 destinations at one
 * uniform 14px/500, with the only real heading being "History" — so "Music
 * Generator" read with exactly the same weight as "Accounting" and "CRM".
 * These headings give the list a spine: content tools vs. the systems a
 * business actually runs on.
 */
function NavSection({ label }: { label: string }) {
  // A hairline beside the label separates groups without spending a whole
  // divider row on it — the list stays dense but stops reading as one long run.
  return (
    <div className="flex items-center gap-2 px-3 pt-4 pb-1.5 select-none">
      <span className="text-[10px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}

function NavItem({ icon: Icon, label, href, active, small = false, accent }: {
  icon: React.ElementType; label: string; href: string; active: boolean; small?: boolean;
  /** Department colour — sub-items inherit their department's hue so the group stays readable when open. */
  accent?: string;
}) {
  const hue = accent || "var(--primary)";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-colors ${small ? "py-1.5 ps-4 pe-3" : "py-2 px-3"}`}
      style={{
        background: active ? "var(--surface-2)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      {/* A rail on the inline-start edge reads as "you are here" at a glance and
          works in both directions, which a left-only border would not. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
          style={{ background: hue, insetInlineStart: 0 }}
        />
      )}
      <Icon className={`flex-shrink-0 ${small ? "w-3.5 h-3.5" : "w-4 h-4"}`} style={{ color: active ? hue : "currentColor" }} />
      <span className="truncate">{label}</span>
    </Link>
  );
}