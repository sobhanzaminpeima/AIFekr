"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Users, Home, ArrowUpRight, Sparkles } from "lucide-react";
import { linkifyCitations } from "@/lib/accounting/linkifyCitations";
import { tri } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";

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

export default function AccountingDashboardPage() {
  const { lang, dir, fmtNum: fmt } = useAccountingLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  useEffect(() => {
    const loadError = tri(lang, "خطا در بارگذاری داشبورد", "Failed to load dashboard", "Dashboard konnte nicht geladen werden");
    fetch("/api/accounting/dashboard", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || loadError);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : loadError));
  }, [lang]);

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center" dir={dir}>
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-secondary)" }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;
  }

  const maxTrend = Math.max(1, ...data.trend.flatMap((t) => [t.revenue, t.expense]));
  const maxExpenseCat = Math.max(1, ...data.expenseByCategory.map((e) => e.amount));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "داشبورد حسابداری", "Accounting Dashboard", "Buchhaltungs-Dashboard")}</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "وضعیت مالی کسب‌وکار شما در یک نگاه", "Your business finances at a glance", "Ihre Geschäftsfinanzen auf einen Blick")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Wallet className="w-4 h-4" />} label={tri(lang, "موجودی نقدی", "Cash balance", "Kassenbestand")} value={fmt(data.cashBalance)} />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label={tri(lang, "درآمد این ماه", "Revenue this month", "Umsatz diesen Monat")} value={fmt(data.monthRevenue)} tone="good" />
        <KpiCard icon={<TrendingDown className="w-4 h-4" />} label={tri(lang, "هزینه این ماه", "Expenses this month", "Ausgaben diesen Monat")} value={fmt(data.monthExpense)} tone="bad" />
        <KpiCard icon={<ArrowUpRight className="w-4 h-4" />} label={tri(lang, "سود خالص", "Net profit", "Nettogewinn")} value={fmt(data.monthNetProfit)} tone={data.monthNetProfit >= 0 ? "good" : "bad"} />
        <KpiCard icon={<Users className="w-4 h-4" />} label={tri(lang, "مطالبات معوق", "Outstanding receivables", "Offene Forderungen")} value={fmt(data.receivablesOutstanding)} />
        <KpiCard icon={<AlertCircle className="w-4 h-4" />} label={tri(lang, "بدهی‌های معوق", "Outstanding payables", "Offene Verbindlichkeiten")} value={fmt(data.payablesOutstanding)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue/expense trend — grouped bars, 6 months */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "روند درآمد و هزینه (۶ ماه اخیر)", "Revenue vs. expenses (last 6 months)", "Umsatz vs. Ausgaben (letzte 6 Monate)")}</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: SERIES_COLORS[0] }} />{tri(lang, "درآمد", "Revenue", "Umsatz")}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: SERIES_COLORS[1] }} />{tri(lang, "هزینه", "Expenses", "Ausgaben")}</span>
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
                      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `${t.label} — ${tri(lang, "درآمد", "Revenue", "Umsatz")}`, value: fmt(t.revenue) })}
                      onMouseLeave={() => setHover(null)}
                    />
                    <rect
                      x={gx + 2} y={140 - hExp} width={barW} height={hExp} rx={2}
                      fill={SERIES_COLORS[1]}
                      onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `${t.label} — ${tri(lang, "هزینه", "Expenses", "Ausgaben")}`, value: fmt(t.expense) })}
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
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{tri(lang, "ترکیب هزینه‌ها بر اساس دسته (این ماه)", "Expense breakdown by category (this month)", "Ausgaben nach Kategorie (dieser Monat)")}</h2>
          {data.expenseByCategory.length === 0 ? (
            <p className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "هزینه‌ای ثبت نشده", "No expenses recorded", "Keine Ausgaben erfasst")}</p>
          ) : (
            <div className="space-y-2.5">
              {data.expenseByCategory.slice(0, 5).map((cat, i) => (
                <div key={cat.code}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    {/* nameEn exists on the account row — use it once the reader isn't on Persian */}
                    <span style={{ color: "var(--text-secondary)" }}>{lang === "fa" ? cat.name : (cat.nameEn || cat.name)}</span>
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
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "فاکتورهای معوق", "Overdue invoices", "Überfällige Rechnungen")}</h2>
          {data.overdueInvoices.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "فاکتور معوقی نیست", "No overdue invoices", "Keine überfälligen Rechnungen")}</p>
          ) : (
            <div className="space-y-2">
              {data.overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</span>
                    {/* logical margin (ms-*) so the gap flips with dir, unlike the old mr-2 */}
                    <span className="text-xs ms-2" style={{ color: "var(--text-muted)" }}>{inv.contactName}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#e34948" }}>{fmt(inv.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Short-term rental summary */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Home className="w-4 h-4" />{tri(lang, "اجاره کوتاه‌مدت", "Short-term rental", "Kurzzeitvermietung")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>{tri(lang, "واحد فعال", "Active units", "Aktive Einheiten")}</span><span style={{ color: "var(--text-primary)" }}>{data.shortTermRental.activeUnits}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>{tri(lang, "کارمزد این ماه", "Fees this month", "Gebühren diesen Monat")}</span><span style={{ color: "var(--text-primary)" }}>{fmt(data.shortTermRental.monthManagementFeeTotal)}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>{tri(lang, "گزارش‌های در انتظار تأیید", "Statements awaiting approval", "Abrechnungen zur Freigabe")}</span><span style={{ color: "var(--text-primary)" }}>{data.shortTermRental.pendingStatements}</span></div>
          </div>
        </div>
      </div>

      {/* Bank reconciliation status */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "وضعیت تطبیق بانکی", "Bank reconciliation status", "Status des Bankabgleichs")}</h2>
          {data.bankUnreconciledCount > 0 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(227,73,72,0.12)", color: "#e34948" }}>
              {data.bankUnreconciledCount} {tri(lang, "تراکنش تطبیق‌نشده", "unreconciled transactions", "nicht abgeglichene Buchungen")}
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(27,175,122,0.12)", color: "#1baf7a" }}>{tri(lang, "همه تطبیق شده", "All reconciled", "Alle abgeglichen")}</span>
          )}
        </div>
      </div>

      <CashFlowNarrativeCard />

      {/* Pending commissions */}
      {data.pendingCommissions.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "کمیسیون‌های معلق پرداخت", "Commissions pending payment", "Ausstehende Provisionen")}</h2>
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

      <div className="flex flex-wrap gap-3 text-sm">
        {[
          { href: "/crm?tab=invoices", label: tri(lang, "مدیریت فاکتورها", "Manage invoices", "Rechnungen verwalten") },
          { href: "/accounting/expenses", label: tri(lang, "هزینه‌ها و تأمین‌کنندگان", "Expenses & vendors", "Ausgaben & Lieferanten") },
          { href: "/accounting/bank", label: tri(lang, "بانک و تطبیق", "Bank & reconciliation", "Bank & Abgleich") },
          { href: "/accounting/ledger-setup", label: tri(lang, "دفتر حساب‌ها، بودجه و مالیات", "Chart of accounts, budget & tax", "Kontenplan, Budget & Steuern") },
          { href: "/accounting/assistant", label: tri(lang, "دستیار هوشمند مالی", "AI finance assistant", "KI-Finanzassistent") },
          { href: "/accounting/payroll", label: tri(lang, "حقوق و دستمزد", "Payroll", "Gehaltsabrechnung") },
          { href: "/accounting/automation", label: tri(lang, "گزارش‌های زمان‌بندی‌شده و BI", "Scheduled reports & BI", "Geplante Berichte & BI") },
          { href: "/accounting/owner-statements", label: tri(lang, "گزارش تسویه مالک", "Owner statements", "Eigentümerabrechnungen") },
          { href: "/accounting/close-period", label: tri(lang, "دوره‌های مالی و بستن حساب‌ها", "Fiscal periods & closing", "Geschäftsperioden & Abschluss") },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{l.label}</Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Spec ۸ item ۴ — a short AI-generated narrative over the (already
 * computed, heuristic) cash-flow forecast. Streams via SSE like the Q&A
 * endpoint; not generated on page load — the user asks for it explicitly,
 * since every generation costs a model call.
 */
function CashFlowNarrativeCard() {
  const { lang } = useAccountingLocale();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genError = tri(lang, "خطا در تولید خلاصه", "Failed to generate summary", "Zusammenfassung konnte nicht erstellt werden");

  async function generate() {
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/accounting/ai/cash-flow-narrative", { method: "POST", credentials: "include" });
      if (!res.ok || !res.body) throw new Error(genError);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          const parsed = JSON.parse(payload) as { text?: string; error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) setText((t) => t + parsed.text);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : genError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Sparkles className="w-4 h-4" />{tri(lang, "خلاصهٔ هوشمند جریان نقدی", "AI cash-flow summary", "KI-Cashflow-Zusammenfassung")}</h2>
        <button onClick={generate} disabled={loading} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
          {loading ? tri(lang, "در حال تولید...", "Generating…", "Wird erstellt…") : text ? tri(lang, "تولید دوباره", "Regenerate", "Neu erstellen") : tri(lang, "تولید خلاصه", "Generate summary", "Zusammenfassung erstellen")}
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "#e34948" }}>{error}</p>}
      {text && <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{linkifyCitations(text)}</p>}
      {!text && !loading && !error && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "بر اساس پیش‌بینی جریان نقدی ۳ ماه آینده، یک خلاصهٔ روایی کوتاه می‌سازد.", "Writes a short narrative summary from the next 3 months' cash-flow forecast.", "Erstellt eine kurze Zusammenfassung aus der Cashflow-Prognose der nächsten 3 Monate.")}</p>}
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
