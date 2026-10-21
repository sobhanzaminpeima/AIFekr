"use client";

import { Building2, Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
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
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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

  async function confirmDelete() {
    if (!deleteTarget || confirmName.trim() !== deleteTarget.name) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/organizations/${deleteTarget.organizationId}/businesses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmName.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setDeleteError(data?.error || tri(lang, "حذف انجام نشد", "Deletion failed", "Löschen fehlgeschlagen", "Silme başarısız")); setDeleting(false); return; }
      // Same reasoning as switchBusiness: every mounted client component needs a hard
      // reload to stop showing the now-deleted business's data.
      window.location.href = "/home";
    } catch {
      setDeleteError(tri(lang, "خطا در ارتباط با سرور", "Network error", "Netzwerkfehler", "Ağ hatası"));
      setDeleting(false);
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
            {group.businesses.map((business) => <div key={business.id} className="w-full flex items-center gap-1 px-3 py-2 hover:bg-white/[.06] group">
              <button onClick={() => switchBusiness(business.id)} className="flex items-center gap-2 flex-1 min-w-0 text-start">
                <span className="w-5 h-5 rounded-md grid place-items-center flex-shrink-0" style={{ background: "var(--surface-1)" }}><Building2 className="w-3 h-3" style={{ color: "var(--primary)" }} /></span>
                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{business.name}</span>
                {business.id === activeBusinessId && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#10b981" }} />}
              </button>
              <button onClick={(event) => { event.stopPropagation(); setDeleteTarget(business); setConfirmName(""); setDeleteError(""); setOpen(false); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md flex-shrink-0 hover:bg-white/[.1] transition-opacity"
                title={tri(lang, "حذف کسب‌وکار", "Delete business", "Unternehmen löschen", "İşletmeyi sil")}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>)}
          </div>)}
        </div>
        <button onClick={() => router.push("/organization/onboarding")} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-white/[.06]" style={{ borderTop: "1px solid var(--border)", color: "var(--primary)" }}><Plus className="w-3.5 h-3.5" />{tri(lang, "افزودن کسب‌وکار", "Add business", "Unternehmen hinzufügen", "İşletme ekle")}</button>
      </div>}
      {deleteTarget && <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ background: "rgba(0,0,0,.6)" }} onClick={() => !deleting && setDeleteTarget(null)}>
        <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }} dir={lang === "fa" ? "rtl" : "ltr"}>
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "حذف کسب‌وکار", "Delete business", "Unternehmen löschen", "İşletmeyi sil")}</h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{tri(lang,
            `این عمل غیرقابل بازگشت است. تمام اطلاعات «${deleteTarget.name}» شامل مخاطبین، معاملات، حسابداری، تاریخچهٔ چت، شبکه‌های اجتماعی و سئو برای همیشه حذف می‌شود. برای تأیید، نام کسب‌وکار را دقیقاً وارد کنید.`,
            `This cannot be undone. All data for "${deleteTarget.name}" -- contacts, deals, accounting, chat history, social media and SEO -- will be permanently deleted. Type the business name exactly to confirm.`,
            `Dies kann nicht rückgängig gemacht werden. Alle Daten für "${deleteTarget.name}" -- Kontakte, Deals, Buchhaltung, Chatverlauf, Social Media und SEO -- werden dauerhaft gelöscht. Geben Sie den Namen zur Bestätigung genau ein.`,
            `Bu geri alınamaz. "${deleteTarget.name}" için tüm veriler -- kişiler, anlaşmalar, muhasebe, sohbet geçmişi, sosyal medya ve SEO -- kalıcı olarak silinecek. Onaylamak için işletme adını tam olarak yazın.`)}</p>
          <input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={deleteTarget.name}
            className="w-full p-2.5 rounded-xl text-sm mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          {deleteError && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{deleteError}</p>}
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{tri(lang, "انصراف", "Cancel", "Abbrechen", "İptal")}</button>
            <button onClick={confirmDelete} disabled={deleting || confirmName.trim() !== deleteTarget.name} className="px-3 py-2 rounded-xl text-xs text-white flex items-center gap-1.5 disabled:opacity-50" style={{ background: "#ef4444" }}>
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {tri(lang, "حذف همیشگی", "Delete permanently", "Endgültig löschen", "Kalıcı olarak sil")}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
