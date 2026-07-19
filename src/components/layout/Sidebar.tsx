"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare, Image as ImageIcon, Video, Music, GalleryHorizontal, Mail,
  ChevronDown, ChevronLeft, Settings, LogOut, Wallet, Crown,
  Briefcase, TrendingUp, ShoppingCart, Calculator, Salad,
  GraduationCap, Stethoscope, Languages, ChefHat, Dumbbell, Plane, Code2,
  Plus, History, HeartPulse, Search, Share2, Globe, Factory, Users,
  FolderOpen, Folder, FolderPlus, X, Check, MoreHorizontal, Trash2, ArrowLeft, Zap, Rocket,
} from "lucide-react";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { useTranslation } from "@/lib/i18n";
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
const PROJECT_COLORS = ["#ea580c", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6b7280"];

export default function Sidebar({ user, conversations = [], onNewChat }: SidebarProps) {
  const pathname = usePathname();
  const { t, lang } = useTranslation();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const projectIdParam = searchParams?.get("project") || null;
  const [toolsOpen, setToolsOpen] = useState(false);
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(true);
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

  const freeConvs = conversations.filter((c) => !c.projectId);
  const getProjectConvs = (pid: string) => conversations.filter((c) => c.projectId === pid);

  return (
    <aside className="flex flex-col h-full w-[220px] flex-shrink-0"
      style={{ background: "var(--surface-1)", borderLeft: lang === "en" ? "none" : "1px solid var(--border)", borderRight: lang === "en" ? "1px solid var(--border)" : "none" }}>

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
          {lang === "en" ? "New Chat" : "گفتگوی جدید"}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        {/* General section */}
        <NavItem icon={MessageSquare} label={t.nav.chat} href="/chat" active={isActive("/chat")} />
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <NavItem icon={ImageIcon} label={t.nav.image} href="/image/generate" active={isActive("/image")} />
        <NavItem icon={Video} label={t.nav.video} href="/video/generate" active={isActive("/video")} />
        <NavItem icon={Music} label={t.nav.music} href="/music/generate" active={isActive("/music")} />
        <NavItem icon={GalleryHorizontal} label={t.nav.gallery} href="/image/gallery" active={isActive("/image/gallery")} />
        <NavItem icon={Rocket} label={t.nav.startupBuilder} href="/startup/builder" active={isActive("/startup")} />
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />

        {/* Tools */}
        <button onClick={() => setToolsOpen(!toolsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" />{t.nav.tools}</span>
          {toolsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {toolsOpen && <div className="pr-4 space-y-0.5">{tools.map((t) => <NavItem key={t.href} icon={t.icon} label={t.label} href={t.href} active={isActive(t.href)} small />)}</div>}

        {/* Assistants */}
        <button onClick={() => setAssistantsOpen(!assistantsOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-2"><GraduationCap className="w-4 h-4" />{t.nav.assistants}</span>
          {assistantsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {assistantsOpen && <div className="pr-4 space-y-0.5">{assistants.map((a) => <NavItem key={a.href} icon={a.icon} label={a.label} href={a.href} active={isActive(a.href)} small />)}</div>}

        {/* ── BUSINESS SECTION ─────────────────── */}
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />

        {hasPack ? (
          <>
            {/* Business tools - user has pack */}
            <button onClick={() => setBusinessOpen(!businessOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: "#ea580c" }} />
                {lang === "en" ? "AI Agents" : "ایجنت‌های هوش مصنوعی"}
              </span>
              {businessOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {businessOpen && (
              <div className="space-y-0.5">
                <NavItem icon={HeartPulse} label={t.nav.businessDoctor} href="/business-doctor" active={isActive("/business-doctor")} />
                <NavItem icon={Crown} label={t.nav.ceoAdvisor} href="/ceo" active={isActive("/ceo")} />
                <NavItem icon={Search} label={t.nav.seoWorkspace} href="/seo" active={isActive("/seo")} />
                <NavItem icon={Share2} label={t.nav.socialMedia} href="/social" active={isActive("/social")} />
                <NavItem icon={Globe} label={t.nav.websiteDesigner} href="/website-designer" active={isActive("/website-designer")} />
                <NavItem icon={Factory} label={t.nav.industryPacks} href="/industry" active={isActive("/industry")} />
                <NavItem icon={Users} label={t.nav.meetingRoom} href="/meeting" active={isActive("/meeting")} />
              </div>
            )}
          </>
        ) : (
          /* No pack - show CTA */
          <Link href="/industry"
            className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all mx-1 mb-1"
            style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.15), rgba(249,115,22,0.1))", border: "1px solid rgba(234,88,12,0.3)", color: "#ea580c" }}>
            <Zap className="w-4 h-4 flex-shrink-0" />
            <div className="text-right leading-tight">
              <div className="font-semibold text-xs">{lang === "en" ? "Grow Your Business" : "رشد کسب‌وکارت"}</div>
              <div className="text-xs opacity-70 mt-0.5">{lang === "en" ? "AI Agent Packs" : "بسته‌های ایجنت AI"}</div>
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
            {lang === "en" ? "Projects" : "پروژه‌ها"}
            {projectsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setCreatingProject(true)} title={lang === "en" ? "New project" : "پروژه جدید"}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {creatingProject && (
          <div className="mx-2 mb-1 p-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <input autoFocus value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createProject(); if (e.key === "Escape") setCreatingProject(false); }}
              placeholder={lang === "en" ? "Project name..." : "نام پروژه..."}
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
                        {lang === "en" ? "Delete" : "حذف"}
                      </button>
                      <button onClick={() => {
                        const newName = prompt(lang === "en" ? "New name:" : "نام جدید:", project.name);
                        if (newName) fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) }).then(loadProjects);
                        setProjectMenuOpen(null);
                      }} className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                        <Settings className="w-3 h-3" />
                        {lang === "en" ? "Rename" : "تغییر نام"}
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
                    {lang === "en" ? "New chat in project" : "چت جدید در پروژه"}
                  </Link>
                  {pConvs.slice(0, 8).map((c) => (
                    <div key={c.id} className="relative flex items-center group" data-dropdown-root>
                      <Link href={`/chat/${c.id}`}
                        className="flex-1 flex items-center px-2 py-1.5 rounded-lg text-xs truncate min-w-0"
                        style={{ color: pathname === `/chat/${c.id}` ? project.color : "var(--text-secondary)", background: pathname === `/chat/${c.id}` ? project.color + "15" : "transparent" }}>
                        <MessageSquare className="w-3 h-3 ml-1.5 flex-shrink-0" style={{ color: project.color, opacity: 0.7 }} />
                        <span className="truncate">{c.title || (lang === "en" ? "Untitled" : "بی‌نام")}</span>
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
                            style={{ color: "#ef4444" }}>
                            <X className="w-3 h-3" />
                            {lang === "en" ? "Remove from project" : "خارج از پروژه"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {pConvs.length === 0 && (
                    <p className="px-2 py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {lang === "en" ? "No chats yet" : "هنوز چتی ندارد"}
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
                  <span className="truncate">{c.title || (lang === "en" ? "Untitled Chat" : "گفتگوی بی‌نام")}</span>
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
                      {lang === "en" ? "Move to project" : "انتقال به پروژه"}
                    </div>
                    {projects.length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {lang === "en" ? "No projects yet" : "پروژه‌ای ندارید"}
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
                    <button onClick={() => setConvMenuOpen(null)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5"
                      style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                      <X className="w-3 h-3" />
                      {lang === "en" ? "Cancel" : "لغو"}
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
                {formatNumber(user.credits)} {lang === "en" ? "credits" : "اعتبار"}
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
              <Crown className="w-4 h-4" />{lang === "en" ? "Business Plans" : "بسته‌های کسب‌وکار"}
            </Link>
          )}
          {user.plan === "FREE" && !hasPack && (
            <Link href="/plans" className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <Crown className="w-4 h-4" />{t.nav.upgrade}
            </Link>
          )}
          <div className="flex gap-2">
            <LanguageSwitcher className="flex-1 justify-center" />
            <ThemeSwitcher className="flex-1 justify-center" />
          </div>
          <div className="flex gap-2">
            <CurrencySelector className="flex-1 justify-center" />
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

function NavItem({ icon: Icon, label, href, active, small = false }: { icon: React.ElementType; label: string; href: string; active: boolean; small?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-3 rounded-xl text-sm font-medium transition-all ${small ? "py-1.5" : "py-2"}`}
      style={{ background: active ? "rgba(234,88,12,0.12)" : "transparent", color: active ? "var(--primary)" : "var(--text-secondary)" }}>
      <Icon className={small ? "w-3.5 h-3.5" : "w-4 h-4"} />
      <span className="truncate">{label}</span>
    </Link>
  );
}