"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check, ChevronDown, LayoutGrid, Image as ImageIcon, Video, Mic, Music, Clapperboard, Briefcase, Share2, Magnet, HeartPulse,
  Upload, ClipboardCheck, Layers, CalendarDays, Dumbbell, Salad, MessageSquare, Search, Globe, Bot, Calculator, Users, Phone, Handshake, Factory,
  GraduationCap, BookOpen, Sparkles, type LucideIcon,
} from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import { destinations, destinationLabel } from "@/lib/navigation/destinations";
import { DEFAULT_TILES, WORKSPACES, workspaceById, type WorkspaceId } from "@/lib/navigation/workspaces";
import { growthEvent } from "@/components/growth/GrowthTracker";
import "./workspace-nav.css";

export const WORKSPACE_CHANGED_EVENT = "aifekr:workspace-changed";
export type WorkspaceState = { enabled: boolean; workspaces: WorkspaceId[]; active: WorkspaceId | null; suggested: WorkspaceId | null };

let cached: Promise<WorkspaceState | null> | null = null;
/** One request shared by the desktop rail, the mobile drawer and the home page. */
function loadWorkspace(fresh = false) {
  if (!cached || fresh) cached = fetch("/api/user/workspaces", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  return cached;
}

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  useEffect(() => {
    let live = true;
    void loadWorkspace().then(s => { if (live) setState(s); });
    const onChange = (e: Event) => setState((e as CustomEvent<WorkspaceState>).detail);
    addEventListener(WORKSPACE_CHANGED_EVENT, onChange);
    return () => { live = false; removeEventListener(WORKSPACE_CHANGED_EVENT, onChange); };
  }, []);
  return state;
}

/** Saves the choice (presentation only) and updates every mounted copy. */
export async function chooseWorkspace(current: WorkspaceState, active: WorkspaceId | null) {
  const workspaces = active && !current.workspaces.includes(active) ? [...current.workspaces, active] : current.workspaces;
  const next = { ...current, active, workspaces };
  dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: next }));
  cached = Promise.resolve(next);
  growthEvent("workspace_switched", { metadata: { to: active ?? "all" } });
  await fetch("/api/user/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active, workspaces }) }).catch(() => {});
}

type Lang4 = "fa" | "en" | "de" | "tr";
export const destinationName = (href: string, lang: Lang4) => { const d = destinations.find(x => x[0] === href); return d ? destinationLabel(d, lang) : href; };

const ICONS: Record<string, LucideIcon> = {
  "/image/generate": ImageIcon, "/video/generate": Video, "/voice-studio": Mic, "/music/generate": Music, "/video-factory": Clapperboard,
  "/crm": Briefcase, "/social": Share2, "/lead-gen": Magnet, "/business-doctor": HeartPulse, "/seo": Search, "/website-designer": Globe,
  "/agents": Bot, "/accounting": Calculator, "/meeting": Users, "/voice-agent": Phone, "/sales": Handshake, "/industry": Factory,
  "/student": GraduationCap, "/student?view=courses&tool=upload": Upload, "/student?view=courses&tool=practice": ClipboardCheck,
  "/student?view=courses&tool=review": Layers, "/student?view=planner": CalendarDays, "/learn": BookOpen,
  "/fitness": Dumbbell, "/assistants/fitness-coach": Dumbbell, "/tools/healthy-diet": Salad, "/chat": MessageSquare,
};
export const iconFor = (href: string): LucideIcon => ICONS[href] ?? Sparkles;

/** One- or two-word labels for the 2×2 tiles; full names stay in the panels and search. */
const SHORT: Record<string, [string, string]> = {
  "/image/generate": ["تصویر", "Image"], "/video/generate": ["ویدیو", "Video"], "/voice-studio": ["صداگذاری", "Voice"], "/music/generate": ["موزیک", "Music"],
  "/video-factory": ["کارخانه ویدیو", "Video Factory"], "/crm": ["مشتریان", "Customers"], "/social": ["شبکه‌های اجتماعی", "Social"], "/lead-gen": ["جذب مشتری", "Leads"],
  "/business-doctor": ["تحلیل کسب‌وکار", "Business check"], "/student?view=courses&tool=upload": ["آپلود جزوه", "Upload notes"],
  "/student?view=courses&tool=practice": ["آزمون", "Quiz"], "/student?view=courses&tool=review": ["فلش‌کارت", "Flashcards"], "/student?view=planner": ["برنامهٔ مطالعه", "Study plan"],
  "/fitness": ["فیت", "FIT"], "/assistants/fitness-coach": ["مربی", "Coach"], "/tools/healthy-diet": ["تغذیه", "Nutrition"], "/chat": ["گفتگو", "Chat"],
};

/** One-line workspace switcher (opens a small list); never changes access. */
export default function WorkspaceSwitcher() {
  const { lang } = useTranslation(), fa = lang === "fa";
  const t = (a: string, b: string) => tri(lang, a, b, b, b);
  const state = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!state?.enabled) return null;
  const ws = workspaceById(state.active);
  const pick = (id: WorkspaceId | null) => { setOpen(false); void chooseWorkspace(state, id); };
  return <div className="ws-nav" ref={rootRef}>
    <button className="ws-switch" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
      <LayoutGrid className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }}/>
      <span className="ws-switch-text"><small>{t("فضای کار", "Workspace")}</small><strong>{ws ? ws.name[fa ? 0 : 1] : t("انتخاب نشده", "Not chosen")}</strong></span>
      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }}/>
    </button>
    {open && <div className="ws-menu" role="listbox" aria-label={t("انتخاب فضای کار", "Choose a workspace")}>
      {WORKSPACES.map(w => <button key={w.id} role="option" aria-selected={state.active === w.id} onClick={() => pick(w.id)}>
        <span><strong>{w.name[fa ? 0 : 1]}</strong><small>{w.tagline[fa ? 0 : 1]}</small></span>{state.active === w.id && <Check className="w-4 h-4"/>}
      </button>)}
      <button role="option" aria-selected={!state.active} onClick={() => pick(null)}><span><strong>{t("بدون فضای کار", "No workspace")}</strong><small>{t("همهٔ ابزارها با هم", "Everything together")}</small></span>{!state.active && <Check className="w-4 h-4"/>}</button>
      <p className="ws-note">{t("فقط ترتیب منو عوض می‌شود؛ پلن، کردیت و دسترسی همان می‌ماند.", "Only the menu order changes; plan, credits and access stay the same.")}</p>
    </div>}
  </div>;
}

/** 2×2 grid of the four most useful tools for the chosen workspace (or the creation tools by default). */
export function QuickTiles({ isActive, isAvailable }: { isActive: (href: string) => boolean; isAvailable: (href: string) => boolean }) {
  const { lang } = useTranslation();
  const state = useWorkspace();
  const tiles = (workspaceById(state?.active)?.tiles ?? DEFAULT_TILES).filter(isAvailable).slice(0, 4);
  return <div className="sb-tiles">{tiles.map(href => {
    const Icon = iconFor(href);
    return <Link key={href} href={href} className="sb-tile" title={destinationName(href, lang)} aria-current={!href.includes("?") && isActive(href) ? "page" : undefined}><Icon className="w-5 h-5"/><span>{SHORT[href]?.[lang === "fa" ? 0 : 1] ?? destinationName(href, lang)}</span></Link>;
  })}</div>;
}

/** The chosen workspace's groups, shown inside the "tools" panel above the full list. */
export function WorkspaceGroups({ isActive, isAvailable }: { isActive: (href: string) => boolean; isAvailable: (href: string) => boolean }) {
  const { lang } = useTranslation(), fa = lang === "fa";
  const ws = workspaceById(useWorkspace()?.active);
  if (!ws) return null;
  return <div className="ws-groups">{ws.groups.map(g => {
    const items = g.hrefs.filter(isAvailable);
    if (!items.length) return null;
    return <div key={g.title[1]}>
      <p className="ws-group-title">{g.title[fa ? 0 : 1]}</p>
      {items.map(href => { const Icon = iconFor(href); return <Link key={href} href={href} className="ws-link" aria-current={!href.includes("?") && isActive(href) ? "page" : undefined}><Icon className="w-4 h-4"/>{destinationName(href, lang)}</Link>; })}
    </div>;
  })}</div>;
}

/** Workspace choice as chips at the top of the tools panel (replaces the big switcher row). */
export function WorkspaceChips() {
  const { lang } = useTranslation(), fa = lang === "fa";
  const state = useWorkspace();
  if (!state?.enabled) return null;
  return <div className="ws-chips" role="group" aria-label={tri(lang, "نمایش برای", "Show tools for", "Werkzeuge für", "Araçlar")}>
    <span className="ws-chips-label">{tri(lang, "نمایش برای:", "Show tools for:", "Werkzeuge für:", "Araçlar:")}</span>
    <button aria-pressed={!state.active} onClick={() => void chooseWorkspace(state, null)}>{tri(lang, "همه", "All", "Alle", "Tümü")}</button>
    {WORKSPACES.map(w => <button key={w.id} aria-pressed={state.active === w.id} onClick={() => void chooseWorkspace(state, w.id)}>{w.name[fa ? 0 : 1]}</button>)}
  </div>;
}
