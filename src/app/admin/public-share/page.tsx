"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Link2, Eye, ImageIcon, Save } from "lucide-react";
import toast from "react-hot-toast";

interface Stats {
  visitsByDay: { date: string; count: number }[];
  totalVisits: number;
  dailyCap: number;
  totalGenerations: number;
  todayGenerations: number;
}

export default function PublicSharePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [capInput, setCapInput] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/admin/public-share", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setStats(d); setCapInput(String(d.dailyCap)); })
      .catch(() => toast.error("خطا در بارگذاری"));
  }
  useEffect(load, []);

  async function saveCap() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/public-share", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCap: capInput }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("ذخیره شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (!stats) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  const maxDay = Math.max(1, ...stats.visitsByDay.map((v) => v.count));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Link2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
          لینک عمومی دهه ۸۰
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          aifekr.com/share/1980s — آمار بازدید و کنترل هزینه‌ی API عکس
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "کل بازدید (۱۴ روز اخیر)", value: stats.totalVisits, color: "#3b82f6", icon: Eye },
          { label: "کل عکس‌های ساخته‌شده", value: stats.totalGenerations, color: "#10b981", icon: ImageIcon },
          { label: "امروز", value: `${stats.todayGenerations} / ${stats.dailyCap}`, color: stats.todayGenerations >= stats.dailyCap ? "#ef4444" : "#f59e0b", icon: ImageIcon },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              <s.icon className="w-3.5 h-3.5" />{s.label}
            </div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Visit chart */}
      <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>بازدید روزانه (۱۴ روز اخیر)</h2>
        {stats.visitsByDay.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>هنوز بازدیدی ثبت نشده</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {stats.visitsByDay.map((v) => (
              <div key={v.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${Math.max(4, (v.count / maxDay) * 100)}%`, background: "var(--primary)" }}
                  title={`${v.date}: ${v.count}`}
                />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{v.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost control */}
      <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>سقف روزانه‌ی ساخت عکس</h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          هر عکس از این لینک از اعتبار حساب ادمین کم می‌شود. وقتی تعداد عکس‌های امروز به این سقف برسد، همه‌ی بازدیدکنندگان پیام «فردا دوباره امتحان کنید» می‌بینند — صرف‌نظر از این‌که خودشان قبلاً استفاده کرده باشند یا نه.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} value={capInput} onChange={(e) => setCapInput(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button onClick={saveCap} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            <Save className="w-3.5 h-3.5" />{saving ? "..." : "ذخیره"}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          هر عکس ~{5} اعتبار هزینه دارد؛ سقف {capInput || stats.dailyCap} عکس در روز یعنی حداکثر {(parseInt(capInput || String(stats.dailyCap), 10) || 0) * 5} اعتبار در روز.
        </p>
      </div>
    </div>
  );
}
