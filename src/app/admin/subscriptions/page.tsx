"use client";

import { formatPrice, toJalali } from "@/lib/utils/jalali";

const SAMPLE = [
  { id: "1", userName: "علی محمدی", plan: "PRO", startDate: new Date(Date.now() - 15 * 86400000).toISOString(), expiry: new Date(Date.now() + 15 * 86400000).toISOString(), amount: 350000, gateway: "zarinpal", status: "active" },
  { id: "2", userName: "زهرا احمدی", plan: "BASIC", startDate: new Date(Date.now() - 5 * 86400000).toISOString(), expiry: new Date(Date.now() + 25 * 86400000).toISOString(), amount: 150000, gateway: "idpay", status: "active" },
  { id: "3", userName: "حسن رضایی", plan: "TEAM", startDate: new Date(Date.now() - 35 * 86400000).toISOString(), expiry: new Date(Date.now() - 5 * 86400000).toISOString(), amount: 800000, gateway: "zarinpal", status: "expired" },
];

const PLAN_NAMES: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };
const PLAN_COLORS: Record<string, string> = { FREE: "#71717a", BASIC: "#3b82f6", PRO: "#ea580c", TEAM: "#8b5cf6" };

export default function AdminSubscriptionsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت اشتراک‌ها</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "اشتراک فعال", value: "۱,۸۹۰", color: "var(--success)" },
          { label: "منقضی این ماه", value: "۲۴۳", color: "var(--warning)" },
          { label: "درآمد این ماه", value: "۴۲,۳۰۰,۰۰۰ ت", color: "var(--primary)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{label}</div>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["کاربر", "پلن", "شروع", "انقضا", "مبلغ", "درگاه", "وضعیت"].map((h) => (
                <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE.map((sub) => (
              <tr key={sub.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{sub.userName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: PLAN_COLORS[sub.plan] + "22", color: PLAN_COLORS[sub.plan] }}>
                    {PLAN_NAMES[sub.plan]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(sub.startDate)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(sub.expiry)}</td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>{formatPrice(sub.amount)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{sub.gateway}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{
                    background: sub.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    color: sub.status === "active" ? "var(--success)" : "var(--danger)",
                  }}>
                    {sub.status === "active" ? "فعال" : "منقضی"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
