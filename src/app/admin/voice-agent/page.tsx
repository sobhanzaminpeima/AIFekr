"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Phone, Search, PhoneCall, CalendarDays, Users, Hash } from "lucide-react";
import toast from "react-hot-toast";

interface Row {
  id: string; name: string | null; email: string | null; phone: string | null;
  voicePlan: string; voicePlanExpiry: string | null;
  _count: { voiceAgents: number; voiceCallLogs: number; voiceAppointments: number };
}
interface Stats {
  activeSubscribers: number; totalAgents: number; agentsWithNumber: number; totalCalls: number; totalAppointments: number;
}

export default function AdminVoiceAgentPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(search ? { search } : {}) });
    const res = await fetch(`/api/admin/voice-agent?${params}`);
    const data = await res.json();
    setRows(data.users || []);
    setStats(data.stats || null);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function setPlan(userId: string, voicePlan: string) {
    const res = await fetch(`/api/admin/voice-agent/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voicePlan, days: 30 }),
    });
    if (!res.ok) { toast.error("خطا در تغییر پلن"); return; }
    toast.success(voicePlan === "ACTIVE" ? "پلن فعال شد" : "پلن لغو شد");
    load();
  }

  const statCards = stats
    ? [
        { icon: Users, label: "مشترکین فعال", value: stats.activeSubscribers, color: "#16a34a" },
        { icon: Phone, label: "کل ایجنت‌ها", value: stats.totalAgents, color: "#0ea5e9" },
        { icon: Hash, label: "شماره تلفن متصل", value: stats.agentsWithNumber, color: "#8b5cf6" },
        { icon: PhoneCall, label: "کل تماس‌ها", value: stats.totalCalls, color: "#f59e0b" },
        { icon: CalendarDays, label: "کل رزروها", value: stats.totalAppointments, color: "#ef4444" },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ایجنت صوتی — مدیریت</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>کاربران، ایجنت‌ها و تماس‌های ماژول Voice Agent</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <s.icon className="w-4 h-4 mb-2" style={{ color: s.color }} />
            <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="جستجو بر اساس نام، ایمیل، تلفن..."
          className="w-full pr-9 pl-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-1)" }}>
              {["کاربر", "پلن", "ایجنت‌ها", "تماس‌ها", "رزروها", "عملیات"].map((h) => (
                <th key={h} className="p-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--text-muted)" }}>کاربری یافت نشد</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="p-3">
                  <div style={{ color: "var(--text-primary)" }}>{r.name || "—"}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.email || r.phone}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: r.voicePlan === "ACTIVE" ? "#16a34a20" : "var(--surface-2)", color: r.voicePlan === "ACTIVE" ? "#16a34a" : "var(--text-muted)" }}>
                    {r.voicePlan === "ACTIVE" ? "فعال" : "بدون افزونه"}
                  </span>
                </td>
                <td className="p-3" style={{ color: "var(--text-secondary)" }}>{r._count.voiceAgents}</td>
                <td className="p-3" style={{ color: "var(--text-secondary)" }}>{r._count.voiceCallLogs}</td>
                <td className="p-3" style={{ color: "var(--text-secondary)" }}>{r._count.voiceAppointments}</td>
                <td className="p-3">
                  {r.voicePlan === "ACTIVE" ? (
                    <button onClick={() => setPlan(r.id, "NONE")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#ef444420", color: "#ef4444" }}>
                      لغو پلن
                    </button>
                  ) : (
                    <button onClick={() => setPlan(r.id, "ACTIVE")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#16a34a20", color: "#16a34a" }}>
                      فعال‌سازی (۳۰ روز)
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            قبلی
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}
