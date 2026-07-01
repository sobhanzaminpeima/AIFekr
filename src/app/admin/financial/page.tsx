export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/prisma";
import { DollarSign, TrendingUp, CreditCard, AlertCircle, Clock } from "lucide-react";

function formatPrice(n: number) { return (n / 10).toLocaleString("fa-IR") + " ت"; }

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "";
  const page = Number(params.page || 1);
  const limit = 20;

  const where = status ? { status } : {};

  const [payments, total, totalRevenue, pendingRevenue, successCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { user: { select: { name: true, phone: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: "SUCCESS" } }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const revenue = totalRevenue._sum.amount || 0;
  const pending = pendingRevenue._sum.amount || 0;

  const statusColor: Record<string, string> = {
    SUCCESS: "#10b981", PENDING: "#f59e0b", FAILED: "#ef4444", REFUNDED: "#8b5cf6",
  };
  const statusLabel: Record<string, string> = {
    SUCCESS: "موفق", PENDING: "در انتظار", FAILED: "ناموفق", REFUNDED: "برگشتی",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت مالی</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>گزارش کامل پرداخت‌ها و درآمد</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "کل درآمد", value: formatPrice(revenue), icon: DollarSign, color: "#10b981" },
          { label: "تراکنش موفق", value: successCount.toLocaleString("fa-IR"), icon: TrendingUp, color: "#3b82f6" },
          { label: "در انتظار", value: formatPrice(pending), icon: Clock, color: "#f59e0b" },
          { label: "کل تراکنش", value: total.toLocaleString("fa-IR"), icon: CreditCard, color: "#ea580c" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: "", l: "همه" }, { v: "SUCCESS", l: "موفق" }, { v: "PENDING", l: "در انتظار" }, { v: "FAILED", l: "ناموفق" }, { v: "REFUNDED", l: "برگشتی" }].map(f => (
          <a key={f.v} href={`?status=${f.v}&page=1`}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: status === f.v ? "var(--primary)" : "var(--surface-1)", color: status === f.v ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {f.l}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              {["کاربر", "پلن", "مبلغ", "درگاه", "وضعیت", "تاریخ"].map(h => (
                <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>تراکنشی یافت نشد</td></tr>
            )}
            {payments.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < payments.length - 1 ? "1px solid var(--border)" : undefined, background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{p.user.name || p.user.phone || p.user.email || "ناشناس"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{p.plan}</span>
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{formatPrice(p.amount)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.gateway}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${statusColor[p.status] || "#71717a"}20`, color: statusColor[p.status] || "#71717a" }}>
                    {statusLabel[p.status] || p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(p.createdAt).toLocaleDateString("fa-IR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <a key={p} href={`?status=${status}&page=${p}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
              style={{ background: p === page ? "var(--primary)" : "var(--surface-1)", color: p === page ? "white" : "var(--text-secondary)" }}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
