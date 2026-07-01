"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, DollarSign, Bot, TrendingUp, TrendingDown, Loader2, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatPrice, formatNumber, toJalaliShort } from "@/lib/utils/jalali";

interface Stats {
  totalUsers: number;
  todayUsers: number;
  activeSubscriptions: number;
  todayRevenue: number;
  revenueChange: string;
  todayRequests: number;
  requestsChange: string;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "#71717a",
  BASIC: "#3b82f6",
  PRO: "#ea580c",
  TEAM: "#8b5cf6",
};

const PLAN_NAMES: Record<string, string> = {
  FREE: "رایگان",
  BASIC: "پایه",
  PRO: "حرفه‌ای",
  TEAM: "تیمی",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [planDist, setPlanDist] = useState<{ plan: string; count: number }[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
      setPlanDist(data.planDistribution);
      setRevenueByDay(
        Object.entries(data.revenueByDay as Record<string, number>).map(([date, revenue]) => ({
          date: toJalaliShort(date),
          revenue,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>داشبورد مدیریت</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>آمار و اطلاعات کلی پلتفرم</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className="w-4 h-4" />
          بروزرسانی
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="کل کاربران"
            value={formatNumber(stats.totalUsers)}
            sub={`+${formatNumber(stats.todayUsers)} امروز`}
            positive
          />
          <StatCard
            icon={DollarSign}
            label="درآمد امروز"
            value={formatPrice(stats.todayRevenue)}
            sub={`${stats.revenueChange}% نسبت به دیروز`}
            positive={parseFloat(stats.revenueChange) >= 0}
          />
          <StatCard
            icon={Bot}
            label="درخواست‌های AI"
            value={formatNumber(stats.todayRequests)}
            sub={`${stats.requestsChange}% نسبت به دیروز`}
            positive={parseFloat(stats.requestsChange) >= 0}
          />
          <StatCard
            icon={TrendingUp}
            label="اشتراک‌های فعال"
            value={formatNumber(stats.activeSubscriptions)}
            sub="در حال حاضر"
            positive
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>درآمد ۳۰ روز گذشته</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#f5f5f5" }}
                formatter={(val) => [formatPrice(Number(val) || 0), "درآمد"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution */}
        <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>توزیع پلن‌ها</h2>
          <PieChart width={200} height={160}>
            <Pie data={planDist} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70}>
              {planDist.map((entry) => (
                <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || "#ea580c"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#f5f5f5" }}
              formatter={(val, name) => [formatNumber(Number(val) || 0) + " نفر", PLAN_NAMES[String(name)] || String(name)]}
            />
          </PieChart>
          <div className="mt-3 space-y-1.5">
            {planDist.map((item) => (
              <div key={item.plan} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[item.plan] }} />
                  <span style={{ color: "var(--text-secondary)" }}>{PLAN_NAMES[item.plan]}</span>
                </div>
                <span style={{ color: "var(--text-primary)" }}>{formatNumber(item.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, positive,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
          <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
      </div>
      <div className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="flex items-center gap-1 text-xs">
        {positive ? (
          <TrendingUp className="w-3 h-3" style={{ color: "var(--success)" }} />
        ) : (
          <TrendingDown className="w-3 h-3" style={{ color: "var(--danger)" }} />
        )}
        <span style={{ color: positive ? "var(--success)" : "var(--danger)" }}>{sub}</span>
      </div>
    </div>
  );
}
