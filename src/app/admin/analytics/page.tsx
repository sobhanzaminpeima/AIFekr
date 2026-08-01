"use client";

import { useEffect, useState } from "react";
import { BarChart2, Users, Share2, TrendingUp, RefreshCw, Activity } from "lucide-react";

interface Summary {
  featureCounts: { type: string; _count: { type: number } }[];
  dau: { date: string; count: number }[];
  totalUsers: number;
  activeLastWeek: number;
  sharesTotal: number;
  topFeaturesAllTime: { type: string; _count: { type: number } }[];
  newUsersCount: number;
}

const FEATURE_LABELS: Record<string, string> = {
  business_doctor: "دکتر کسب‌وکار",
  content_pipeline: "خط تولید محتوا",
  chat: "چت AI",
  image_generate: "تولید تصویر",
  video_generate: "تولید ویدئو",
  music_generate: "تولید موسیقی",
  social_generate: "پست شبکه اجتماعی",
  website_designer: "طراح سایت",
  ceo_orchestrator: "اتاق هیئت‌مدیره",
  startup_builder: "استارتاپ بیلدر",
  seo_agent: "agent سئو",
  meeting: "اتاق جلسه",
};

function label(type: string) {
  return FEATURE_LABELS[type] ?? type;
}

function StatCard({ icon: Icon, title, value, sub, color }: { icon: React.ElementType; title: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{title}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/summary", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface-0)" }}>
      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center" style={{ color: "#ef4444" }}>{error}</div>
  );

  const maxFeature = Math.max(...(data?.topFeaturesAllTime.map(f => f._count.type) ?? [1]));
  const maxDau = Math.max(...(data?.dau.map(d => d.count) ?? [1]));

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }} dir="rtl">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
              <BarChart2 className="w-6 h-6" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>آنالیتیکس فیچرها</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>کاربران چه ابزارهایی را بیشتر استفاده می‌کنند؟</p>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <RefreshCw className="w-4 h-4" /> بروزرسانی
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} title="کل کاربران" value={data?.totalUsers ?? 0} color="#6366f1" />
          <StatCard icon={Activity} title="فعال هفته اخیر" value={data?.activeLastWeek ?? 0} sub="کاربر منحصربه‌فرد" color="#10b981" />
          <StatCard icon={Share2} title="لینک share شده" value={data?.sharesTotal ?? 0} sub="آنالیز + محتوا" color="#f97316" />
          <StatCard icon={TrendingUp} title="کاربران جدید" value={data?.newUsersCount ?? 0} sub="۳۰ روز اخیر" color="#a855f7" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Feature usage bar chart */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold mb-5" style={{ color: "var(--text-primary)" }}>پرکاربردترین فیچرها (کل)</h2>
            <div className="space-y-3">
              {(data?.topFeaturesAllTime ?? []).map((f) => {
                const pct = Math.round((f._count.type / maxFeature) * 100);
                return (
                  <div key={f.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "var(--text-secondary)" }}>{label(f.type)}</span>
                      <span style={{ color: "var(--text-muted)" }}>{f._count.type.toLocaleString("fa-IR")}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
              {(data?.topFeaturesAllTime ?? []).length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>هنوز داده‌ای ثبت نشده</p>
              )}
            </div>
          </div>

          {/* DAU chart */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold mb-5" style={{ color: "var(--text-primary)" }}>کاربران فعال روزانه (۱۴ روز)</h2>
            <div className="flex items-end gap-1.5 h-40">
              {(data?.dau ?? []).map((d) => {
                const pct = maxDau > 0 ? (d.count / maxDau) * 100 : 0;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                    <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 4)}%`, background: "var(--primary)", opacity: 0.8 }} />
                    <span className="text-[9px] rotate-45 origin-left" style={{ color: "var(--text-muted)" }}>
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
              {(data?.dau ?? []).length === 0 && (
                <p className="w-full text-sm text-center" style={{ color: "var(--text-muted)" }}>هنوز داده‌ای ثبت نشده</p>
              )}
            </div>
          </div>
        </div>

        {/* Feature usage last 30 days table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>استفاده از فیچرها — ۳۰ روز اخیر</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="text-right px-6 py-3 font-medium" style={{ color: "var(--text-muted)" }}>فیچر</th>
                <th className="text-right px-6 py-3 font-medium" style={{ color: "var(--text-muted)" }}>تعداد استفاده</th>
              </tr>
            </thead>
            <tbody>
              {(data?.featureCounts ?? []).map((f, i) => (
                <tr key={f.type} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td className="px-6 py-3" style={{ color: "var(--text-primary)" }}>{label(f.type)}</td>
                  <td className="px-6 py-3 font-mono" style={{ color: "var(--text-secondary)" }}>{f._count.type.toLocaleString("fa-IR")}</td>
                </tr>
              ))}
              {(data?.featureCounts ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center" style={{ color: "var(--text-muted)" }}>هنوز رویدادی ثبت نشده</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
