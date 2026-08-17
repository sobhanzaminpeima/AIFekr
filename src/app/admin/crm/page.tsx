"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Users, Search, Loader2 } from "lucide-react";
import { toJalali, formatNumber } from "@/lib/utils/jalali";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "لید", color: "#71717a" },
  prospect: { label: "احتمالی", color: "#3b82f6" },
  active: { label: "فعال", color: "#10b981" },
  churned: { label: "از دست رفته", color: "#ef4444" },
  vip: { label: "VIP", color: "#f59e0b" },
};

interface WorkspaceRow {
  ownerId: string;
  owner: { id: string; name: string | null; email: string | null; phone: string | null; plan: string; crmPlan: string } | null;
  count: number;
  statuses: Record<string, number>;
  lastCreatedAt: string;
}

export default function AdminCrmPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/crm");
        const data = await res.json();
        if (!res.ok) {
          setError(true);
          return;
        }
        setWorkspaces(data.workspaces ?? []);
        setTotalContacts(data.totalContacts ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = workspaces.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.owner?.name?.toLowerCase().includes(q) ||
      w.owner?.email?.toLowerCase().includes(q) ||
      w.owner?.phone?.includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>نمای کلی CRM مستأجران</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          این بخش فقط جهت نظارت است — {formatNumber(totalContacts)} مخاطب در {formatNumber(workspaces.length)} فضای کاری. ویرایش مخاطبین واقعی هر کسب‌وکار فقط از داخل CRM خودشان انجام می‌شود.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
          خطا در دریافت اطلاعات CRM. لطفاً دوباره تلاش کنید.
        </div>
      )}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو بر اساس نام، ایمیل یا موبایل صاحب فضای کاری..."
          className="w-full pr-9 pl-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          هیچ فضای کاری CRM فعالی یافت نشد
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => (
            <div key={w.ownerId} className="p-4 rounded-2xl flex items-center gap-4 flex-wrap" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-48">
                <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{w.owner?.name || "بدون نام"}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{w.owner?.email || w.owner?.phone || "—"}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(w.statuses).map(([status, count]) => {
                  const s = STATUS_LABELS[status] || { label: status, color: "#71717a" };
                  return (
                    <span key={status} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${s.color}20`, color: s.color }}>
                      {s.label}: {formatNumber(count)}
                    </span>
                  );
                })}
              </div>
              <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(w.count)} مخاطب</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>آخرین: {toJalali(w.lastCreatedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
