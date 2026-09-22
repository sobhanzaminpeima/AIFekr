"use client";

import { Building2, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, useTranslation } from "@/lib/i18n";

type Business = { id: string; name: string; logoUrl?: string | null; organizationId: string };
type Group = { organization: { id: string; name: string; logoUrl?: string | null }; businesses: Business[] };

/** A navigation-level switcher; selection is authorized server-side before it is persisted. */
export default function OrganizationSwitcher() {
  const { lang } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/organizations", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) { setGroups(data.organizations || []); setActiveBusinessId(data.activeBusinessId || null); } })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = groups.flatMap((group) => group.businesses.map((business) => ({ business, organization: group.organization }))).find(({ business }) => business.id === activeBusinessId);
  if (!active) return null; // legacy user during the one-time backfill, or a transient API failure

  async function switchBusiness(businessId: string) {
    if (businessId === activeBusinessId || switching) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/organizations/context", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) });
      if (!response.ok) { setSwitching(false); return; }
      // A full reload, not router.refresh(): most of the app (Home, CRM, chat history,
      // accounting, social/Instagram...) fetches its own data client-side from a mounted
      // component that has no reason to know the active business just changed under it.
      // router.refresh() only re-runs server components on the CURRENT route -- every
      // other already-mounted client component keeps showing the previous business's
      // data until a hard reload, which is exactly the bug this works around.
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div ref={root} className="relative px-2 pb-2">
      <button onClick={() => setOpen((value) => !value)} aria-expanded={open}
        className="w-full flex items-center gap-2 p-2 rounded-xl text-start hover:bg-white/[0.05] transition-colors"
        style={{ border: "1px solid var(--border)" }}>
        <span className="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0" style={{ background: "rgba(234,88,12,.16)", color: "var(--primary)" }}><Building2 className="w-4 h-4" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{active.business.name}</span><span className="block truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{active.organization.name}</span></span>
        {switching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />}
      </button>
      {open && <div className="absolute z-50 top-full inset-x-2 mt-1 rounded-xl overflow-hidden shadow-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>{tri(lang, "سازمان و کسب‌وکار", "ORGANIZATION & BUSINESS", "ORGANISATION & UNTERNEHMEN", "ORGANİZASYON VE İŞLETME")}</div>
        <div className="max-h-64 overflow-y-auto pb-1">
          {groups.map((group) => <div key={group.organization.id}>
            <div className="px-3 py-1 text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{group.organization.name}</div>
            {group.businesses.map((business) => <button key={business.id} onClick={() => switchBusiness(business.id)} className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-white/[.06]">
              <span className="w-5 h-5 rounded-md grid place-items-center" style={{ background: "var(--surface-1)" }}><Building2 className="w-3 h-3" style={{ color: "var(--primary)" }} /></span>
              <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{business.name}</span>
              {business.id === activeBusinessId && <Check className="w-3.5 h-3.5" style={{ color: "#10b981" }} />}
            </button>)}
          </div>)}
        </div>
        <button onClick={() => router.push("/organization/onboarding")} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-white/[.06]" style={{ borderTop: "1px solid var(--border)", color: "var(--primary)" }}><Plus className="w-3.5 h-3.5" />{tri(lang, "افزودن کسب‌وکار", "Add business", "Unternehmen hinzufügen", "İşletme ekle")}</button>
      </div>}
    </div>
  );
}
