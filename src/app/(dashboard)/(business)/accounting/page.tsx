"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Users, Home, ArrowUpRight } from "lucide-react";

interface DashboardData {
  cashBalance: number;
  receivablesOutstanding: number;
  payablesOutstanding: number;
  monthRevenue: number;
  monthExpense: number;
  monthNetProfit: number;
  trend: { label: string; revenue: number; expense: number }[];
  expenseByCategory: { code: string; name: string; nameEn: string | null; amount: number }[];
  overdueInvoices: { id: string; invoiceNumber: string; total: number; dueDate: string | null; contactName: string }[];
  pendingCommissions: { id: string; dealTitle: string; agentUserId: string; amount: number }[];
  bankUnreconciledCount: number;
  shortTermRental: { activeUnits: number; monthManagementFeeTotal: number; pendingStatements: number };
}

// Reference categorical palette (dataviz skill) — fixed order, validated for
// adjacent-pair CVD separation. Revenue = slot 1 (blue), Expense = slot 2
// (orange), expense categories beyond that continue the same fixed order.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

export default function AccountingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  useEffect(() => {
    fetch("/api/accounting/dashboard", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "خطا در بارگذاری داشبورد");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری داشبورد"));
  }, []);

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center" dir="rtl">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-secondary)" }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;
  }

  const maxTrend = Math.max(1, ...data.trend.flatMap((t) => [t.revenue, t.expense]));
  const maxExpenseCat = Math.max(1, ...data.expenseByCategory.map((e) => e.amount));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>داشبورد حسابداری</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>وضعیت مالی کسب‌وکار شما در یک نگاه</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Wallet className="w-4 h-4" />} label="موجودی نقدی" value={fmt(data.cashBalance)} />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="درآمد این ماه" value={fmt(data.monthRevenue)} tone="good" />
        <KpiCard icon={<TrendingDown className="w-4 h-4" />} label="هزینه این ماه" value={fmt(data.monthExpense)} tone="bad" />
        <KpiCard icon={<ArrowUpRight className="w-4 h-4" />} label="سود خالص" value={fmt(data.monthNetProfit)} tone={data.monthNetProfit >= 0 ? "good" : "bad"} />
        <KpiCard icon={<Users className="w-4 h-4" />} label="مطالبات معوق" value={fmt(data.receivablesOutstanding)} />
        <KpiCard icon={<AlertCircle className="w-4 h-4" />} label="بدهی‌های معوق" value={fmt(data.payablesOutstanding)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue/expense trend — grouped bars, 6 months */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>روند درآمد و هزینه (۶ ماه اخیر)</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: SERIES_COLORS[0] }} />درآمد</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: SERIES_COLORS[1] }} />هزینه</span>
            </div>
          </div>
          <div className="relative">
            <svg viewBox="0 0 360 160" className="w-full" style={{ overflow: "visible" }}>
              {data.trend.map((t, i) => {
                const groupW = 360 / data.trend.length;
                const barW = groupW * 0.28;
                const gx = i * groupW + groupW / 2;
                const hRev = (t.revenue / maxTrend) * 120;
                const hExp = (t.expense / maxTrend) * 120;
                return (
                  <g key={i}>
                    <rect
                      x={gx - barW - 2} y={140 - hRev} width={barW} height={hRev} rx={2}
                      fill={SERIES_COLORS[0]}
                      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `${t.label} — درآمد`, value: fmt(t.revenue) })}
                      onMouseLeave={() => setHover(null)}
                    />
                    <rect
                      x={gx + 2} y={140 - hExp} width={barW} height={hExp} rx={2}
                      fill={SERIES_COLORS[1]}
                      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `${t.label} — هزینه`, value: fmt(t.expense) })}
                      onMouseLeave={() => setHover(null)}
                    />
                    <text x={gx} y={155} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{t.label}</text>
                  </g>
                );
              })}
              <line x1="0" y1="140" x2="360" y2="140" stroke="var(--border)" strokeWidth="1" />
            </svg>
            {hover && (
              <div className="fixed z-50 px-2 py-1 rounded-lg text-xs pointer-events-none" style={{ left: hover.x + 10, top: hover.y - 30, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {hover.label}: {hover.value}
              </div>
            )}
          </div>
        </div>

        {/* Expense breakdown by category */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>ترکیب هزینه‌ها بر اساس دسته (این ماه)</h2>
          {data.expenseByCategory.length === 0 ? (
            <p className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>هزینه‌ای ثبت نشده</p>
          ) : (
            <div className="space-y-2.5">
              {data.expenseByCategory.slice(0, 5).map((cat, i) => (
                <div key={cat.code}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>{cat.name}</span>
                    <span style={{ color: "var(--text-primary)" }}>{fmt(cat.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(cat.amount / maxExpenseCat) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overdue invoices */}
        <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>فاکتورهای معوق</h2>
          {data.overdueInvoices.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>فاکتور معوقی نیست</p>
          ) : (
            <div className="space-y-2">
              {data.overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</span>
                    <span className="text-xs mr-2" style={{ color: "var(--text-muted)" }}>{inv.contactName}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#e34948" }}>{fmt(inv.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Short-term rental summary */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Home className="w-4 h-4" />اجاره کوتاه‌مدت</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>واحد فعال</span><span style={{ color: "var(--text-primary)" }}>{data.shortTermRental.activeUnits}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>کارمزد این ماه</span><span style={{ color: "var(--text-primary)" }}>{fmt(data.shortTermRental.monthManagementFeeTotal)}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>گزارش‌های در انتظار تأیید</span><span style={{ color: "var(--text-primary)" }}>{data.shortTermRental.pendingStatements}</span></div>
          </div>
        </div>
      </div>

      {/* Pending commissions */}
      {data.pendingCommissions.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>کمیسیون‌های معلق پرداخت</h2>
          <div className="space-y-2">
            {data.pendingCommissions.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-primary)" }}>{c.dealTitle}</span>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{fmt(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 text-sm">
        <Link href="/crm?tab=invoices" className="px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>مدیریت فاکتورها</Link>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "#1baf7a" : tone === "bad" ? "#e34948" : "var(--text-primary)";
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-muted)" }}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-base font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
