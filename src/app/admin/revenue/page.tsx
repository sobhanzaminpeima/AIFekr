"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/lib/utils/jalali";

const SAMPLE_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1}/۶`,
  revenue: Math.floor(Math.random() * 5000000 + 1000000),
  transactions: Math.floor(Math.random() * 30 + 5),
}));

export default function AdminRevenuePage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت پرداخت‌ها</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "درآمد امروز", value: "۴,۲۳۰,۰۰۰ ت" },
          { label: "درآمد این ماه", value: "۴۲,۳۰۰,۰۰۰ ت" },
          { label: "تراکنش موفق", value: "۱,۸۴۵" },
          { label: "نرخ شکست", value: "۲.۳٪" },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{label}</div>
            <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>درآمد ۳۰ روز گذشته</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={SAMPLE_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#f5f5f5" }}
              formatter={(val) => [formatPrice(Number(val)), "درآمد"]}
            />
            <Line type="monotone" dataKey="revenue" stroke="#ea580c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
