"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Plus, BookOpen, Target, Percent } from "lucide-react";

interface Account { id: string; code: string; name: string; type: string; isSystem: boolean; }
interface BudgetRow { accountCode: string; accountName: string; budgeted: number; actual: number; variance: number; variancePercent: number; }
interface TaxRate { id: string; name: string; ratePercent: number; isDefault: boolean; }
interface VatReport { outputTax: number; inputTax: number; netPayable: number; }

const TYPE_LABEL: Record<string, string> = { asset: "دارایی", liability: "بدهی", equity: "حقوق صاحبان سهام", revenue: "درآمد", expense: "هزینه" };

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

export default function LedgerSetupPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [vat, setVat] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accCode, setAccCode] = useState("");
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("expense");

  const [budgetAccount, setBudgetAccount] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  const [taxName, setTaxName] = useState("");
  const [taxPercent, setTaxPercent] = useState("");

  const load = useCallback(async () => {
    const period = `${budgetPeriod}-01`;
    const [accRes, budRes, taxRes, vatRes] = await Promise.all([
      fetch("/api/accounting/accounts", { credentials: "include" }),
      fetch(`/api/accounting/budgets?period=${period}`, { credentials: "include" }),
      fetch("/api/accounting/tax-rates", { credentials: "include" }),
      fetch("/api/accounting/reports/vat", { credentials: "include" }),
    ]);
    const accJson = await accRes.json();
    const budJson = await budRes.json();
    const taxJson = await taxRes.json();
    const vatJson = await vatRes.json();
    if (accRes.ok) setAccounts(accJson.accounts);
    if (budRes.ok) setBudgetRows(budJson.rows);
    if (taxRes.ok) setTaxRates(taxJson.taxRates);
    if (vatRes.ok) setVat(vatJson);
    setLoading(false);
  }, [budgetPeriod]);

  useEffect(() => { load(); }, [load]);

  async function addAccount() {
    if (!accCode.trim() || !accName.trim()) return toast.error("کد و نام حساب را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accCode, name: accName, type: accType }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("حساب اضافه شد");
      setAccCode(""); setAccName("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در افزودن حساب");
    } finally {
      setBusy(false);
    }
  }

  async function saveBudget() {
    if (!budgetAccount || !budgetAmount) return toast.error("حساب و مبلغ را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/budgets", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode: budgetAccount, period: `${budgetPeriod}-01`, amount: Number(budgetAmount) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("بودجه ثبت شد");
      setBudgetAmount("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت بودجه");
    } finally {
      setBusy(false);
    }
  }

  async function addTaxRate() {
    if (!taxName.trim() || !taxPercent) return toast.error("نام و درصد نرخ مالیات را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/tax-rates", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: taxName, ratePercent: Number(taxPercent) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("نرخ مالیات اضافه شد");
      setTaxName(""); setTaxPercent("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در افزودن نرخ مالیات");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>دفتر حساب‌ها، بودجه و مالیات</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>مدیریت ساختار حسابداری کسب‌وکار</p>
        </div>
      </div>

      {/* Chart of Accounts */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><BookOpen className="w-4 h-4" />دفتر حساب‌ها ({accounts.length})</h2>
        <div className="max-h-64 overflow-auto space-y-1 mb-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounting/accounts/${a.code}`} className="flex items-center justify-between text-sm py-1.5 hover:opacity-80" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{a.code} — {a.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{TYPE_LABEL[a.type] || a.type}{a.isSystem ? " · پیش‌فرض" : ""}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={accCode} onChange={(e) => setAccCode(e.target.value)} placeholder="کد حساب" className="w-28 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="نام حساب" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={accType} onChange={(e) => setAccType(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button disabled={busy} onClick={addAccount} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />افزودن حساب
          </button>
        </div>
      </div>

      {/* Budget */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Target className="w-4 h-4" />بودجه‌بندی</h2>
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <input type="month" value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div className="space-y-1 mb-3">
          {budgetRows.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>بودجه‌ای برای این ماه تعریف نشده</p>
          ) : budgetRows.map((r) => (
            <div key={r.accountCode} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{r.accountName}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>بودجه: {fmt(r.budgeted)} — واقعی: {fmt(r.actual)} — انحراف: <span style={{ color: r.variance > 0 ? "#e34948" : "#1baf7a" }}>{Math.round(r.variancePercent)}٪</span></span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={budgetAccount} onChange={(e) => setBudgetAccount(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">حساب هزینه</option>
            {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
          <input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="مبلغ بودجه" type="number" className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={saveBudget} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />ثبت بودجه
          </button>
        </div>
      </div>

      {/* Tax */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Percent className="w-4 h-4" />نرخ‌های مالیاتی و گزارش ارزش‌افزوده</h2>
        {vat && (
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>مالیات خروجی (فروش): {fmt(vat.outputTax)}</span>
            <span>مالیات ورودی (خرید): {fmt(vat.inputTax)}</span>
            <span>مبلغ قابل‌پرداخت: <b style={{ color: "var(--text-primary)" }}>{fmt(vat.netPayable)}</b></span>
          </div>
        )}
        <div className="space-y-1 mb-3">
          {taxRates.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{t.name}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.ratePercent}٪{t.isDefault ? " · پیش‌فرض" : ""}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="نام نرخ (مثلاً VAT عمومی)" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="درصد" type="number" className="w-24 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addTaxRate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />افزودن نرخ
          </button>
        </div>
      </div>
    </div>
  );
}
