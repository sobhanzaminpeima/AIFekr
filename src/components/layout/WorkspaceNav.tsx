"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import { destinations, destinationLabel } from "@/lib/navigation/destinations";
import { WORKSPACES, workspaceById, type WorkspaceId } from "@/lib/navigation/workspaces";
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

const label = (href: string, lang: "fa" | "en" | "de" | "tr") => { const d = destinations.find(x => x[0] === href); return d ? destinationLabel(d, lang) : href; };

/**
 * Workspace switcher + workspace-first menu at the top of the sidebar. With no
 * workspace chosen the classic menu below is unchanged. Visibility here is
 * never a permission: pages and APIs keep their own checks.
 */
export default function WorkspaceNav({ isActive, isAvailable, showAll, onToggleAll }: { isActive: (href: string) => boolean; isAvailable: (href: string) => boolean; showAll: boolean; onToggleAll: () => void }) {
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
  const ordered = [...WORKSPACES].sort((a, b) => Number(state.workspaces.includes(b.id)) - Number(state.workspaces.includes(a.id)));
  return <div className="ws-nav" ref={rootRef}>
    <button className="ws-switch" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
      <LayoutGrid className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }}/>
      <span className="ws-switch-text"><small>{t("فضای کار", "Workspace")}</small><strong>{ws ? ws.name[fa ? 0 : 1] : t("همهٔ ابزارها", "All tools")}</strong></span>
      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }}/>
    </button>
    {open && <div className="ws-menu" role="listbox" aria-label={t("انتخاب فضای کار", "Choose a workspace")}>
      {ordered.map(w => <button key={w.id} role="option" aria-selected={state.active === w.id} onClick={() => pick(w.id)}>
        <span><strong>{w.name[fa ? 0 : 1]}</strong><small>{w.tagline[fa ? 0 : 1]}</small></span>{state.active === w.id && <Check className="w-4 h-4"/>}
      </button>)}
      <button role="option" aria-selected={!state.active} onClick={() => pick(null)}><span><strong>{t("همهٔ ابزارها (منوی کامل)", "All tools (full menu)")}</strong><small>{t("منوی کلاسیک بدون فیلتر", "The classic, unfiltered menu")}</small></span>{!state.active && <Check className="w-4 h-4"/>}</button>
      <p className="ws-note">{t("فضای کار فقط ترتیب منو را عوض می‌کند؛ پلن، کردیت و دسترسی شما تغییری نمی‌کند.", "A workspace only changes what the menu shows first; your plan, credits and access stay the same.")}</p>
    </div>}
    {!ws && state.suggested && <button className="ws-suggest" onClick={() => pick(state.suggested)}>{t(`منوی ساده‌تر برای «${workspaceById(state.suggested)!.name[0]}»`, `Simpler menu for “${workspaceById(state.suggested)!.name[1]}”`)}</button>}
    {ws && <div className="ws-groups">
      {ws.groups.map(g => {
        const items = g.hrefs.filter(isAvailable);
        if (!items.length) return null;
        return <div key={g.title[1]}>
          <p className="ws-group-title">{g.title[fa ? 0 : 1]}</p>
          {items.map(href => <Link key={href} href={href} className="ws-link" aria-current={isActive(href.split("?")[0]) && !href.includes("?") ? "page" : undefined}>{label(href, lang)}</Link>)}
        </div>;
      })}
      <button className="ws-all" aria-expanded={showAll} onClick={onToggleAll}>{showAll ? t("بستن همهٔ ابزارها", "Hide all tools") : t("همهٔ ابزارها", "All tools")}<ChevronDown className="w-3.5 h-3.5" style={{ transform: showAll ? "none" : "rotate(-90deg)" }}/></button>
    </div>}
  </div>;
}
