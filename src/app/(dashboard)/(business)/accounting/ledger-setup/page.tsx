"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Plus, BookOpen, Target, Percent } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";

interface Account { id: string; code: string; name: string; type: string; isSystem: boolean; }
interface BudgetRow { accountCode: string; accountName: string; budgeted: number; actual: number; variance: number; variancePercent: number; }
interface TaxRate { id: string; name: string; ratePercent: number; isDefault: boolean; }
interface VatReport { outputTax: number; inputTax: number; netPayable: number; }

function typeLabel(type: string, lang: Lang): string {
  switch (type) {
    case "asset": return tri(lang, "دارایی", "Asset", "Aktiva");
    case "liability": return tri(lang, "بدهی", "Liability", "Passiva");
    case "equity": return tri(lang, "حقوق صاحبان سهام", "Equity", "Eigenkapital");
    case "revenue": return tri(lang, "درآمد", "Revenue", "Ertrag");
    default: return tri(lang, "هزینه", "Expense", "Aufwand");
  }
}

export default function LedgerSetupPage() {
  const { lang, dir, fmtNum: fmt, fmtDate, fmtMonth: monthLabel } = useAccountingLocale();
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
    if (!accCode.trim() || !accName.trim()) return toast.error(tri(lang, "کد و نام حساب را وارد کنید", "Enter the account code and name", "Kontonummer und -name eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accCode, name: accName, type: accType }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "حساب اضافه شد", "Account added", "Konto hinzugefügt"));
      setAccCode(""); setAccName("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در افزودن حساب", "Failed to add the account", "Konto konnte nicht hinzugefügt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBudget() {
    if (!budgetAccount || !budgetAmount) return toast.error(tri(lang, "حساب و مبلغ را وارد کنید", "Enter an account and an amount", "Konto und Betrag eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/budgets", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode: budgetAccount, period: `${budgetPeriod}-01`, amount: Number(budgetAmount) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "بودجه ثبت شد", "Budget saved", "Budget gespeichert"));
      setBudgetAmount("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ثبت بودجه", "Failed to save the budget", "Budget konnte nicht gespeichert werden"));
    } finally {
      setBusy(false);
    }
  }

  async function addTaxRate() {
    if (!taxName.trim() || !taxPercent) return toast.error(tri(lang, "نام و درصد نرخ مالیات را وارد کنید", "Enter the tax rate name and percentage", "Name und Prozentsatz des Steuersatzes eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/tax-rates", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: taxName, ratePercent: Number(taxPercent) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "نرخ مالیات اضافه شد", "Tax rate added", "Steuersatz hinzugefügt"));
      setTaxName(""); setTaxPercent("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در افزودن نرخ مالیات", "Failed to add the tax rate", "Steuersatz konnte nicht hinzugefügt werden"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;

  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "دفتر حساب‌ها، بودجه و مالیات", "Chart of accounts, budget & tax", "Kontenplan, Budget & Steuern")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "مدیریت ساختار حسابداری کسب‌وکار", "Manage your business's accounting structure", "Buchhaltungsstruktur Ihres Unternehmens verwalten")}</p>
        </div>
      </div>

      {/* Chart of Accounts */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><BookOpen className="w-4 h-4" />{tri(lang, "دفتر حساب‌ها", "Chart of accounts", "Kontenplan")} ({accounts.length})</h2>
        <div className="max-h-64 overflow-auto space-y-1 mb-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounting/accounts/${a.code}`} className="flex items-center justify-between text-sm py-1.5 hover:opacity-80" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{a.code} — {a.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{typeLabel(a.type, lang) || a.type}{a.isSystem ? tri(lang, " · پیش‌فرض", " · default", " · Standard") : ""}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={accCode} onChange={(e) => setAccCode(e.target.value)} placeholder={tri(lang, tri(lang, "کد حساب", "Account code", "Kontonummer"), "Account code", "Kontonummer")} className="w-28 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder={tri(lang, tri(lang, "نام حساب", "Account name", "Kontoname"), "Account name", "Kontoname")} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={accType} onChange={(e) => setAccType(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {["asset", "liability", "equity", "revenue", "expense"].map((k) => <option key={k} value={k}>{typeLabel(k, lang)}</option>)}
          </select>
          <button disabled={busy} onClick={addAccount} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "افزودن حساب", "Add account", "Konto hinzufügen")}
          </button>
        </div>
      </div>

      {/* Budget */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Target className="w-4 h-4" />{tri(lang, "بودجه‌بندی", "Budgeting", "Budgetierung")}</h2>
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <input type="month" value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div className="space-y-1 mb-3">
          {budgetRows.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "بودجه‌ای برای این ماه تعریف نشده", "No budget defined for this month", "Für diesen Monat ist kein Budget definiert")}</p>
          ) : budgetRows.map((r) => (
            <div key={r.accountCode} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{r.accountName}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "بودجه", "Budget", "Budget")}: {fmt(r.budgeted)} — {tri(lang, "واقعی", "Actual", "Ist")}: {fmt(r.actual)} — {tri(lang, "انحراف", "Variance", "Abweichung")}: <span style={{ color: r.variance > 0 ? "#e34948" : "#1baf7a" }}>{Math.round(r.variancePercent)}٪</span></span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={budgetAccount} onChange={(e) => setBudgetAccount(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "حساب هزینه", "Expense account", "Aufwandskonto")}</option>
            {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
          <input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder={tri(lang, tri(lang, "مبلغ بودجه", "Budget amount", "Budgetbetrag"), "Budget amount", "Budgetbetrag")} type="number" className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={saveBudget} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "ثبت بودجه", "Save budget", "Budget speichern")}
          </button>
        </div>
      </div>

      {/* Tax */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Percent className="w-4 h-4" />{tri(lang, "نرخ‌های مالیاتی و گزارش ارزش‌افزوده", "Tax rates & VAT reporting", "Steuersätze & USt-Meldung")}</h2>
        {vat && (
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{tri(lang, "مالیات خروجی (فروش)", "Output tax (sales)", "Umsatzsteuer (Verkauf)")}: {fmt(vat.outputTax)}</span>
            <span>{tri(lang, "مالیات ورودی (خرید)", "Input tax (purchases)", "Vorsteuer (Einkauf)")}: {fmt(vat.inputTax)}</span>
            <span>{tri(lang, "مبلغ قابل‌پرداخت: ", "Amount payable: ", "Zahlbarer Betrag: ")}<b style={{ color: "var(--text-primary)" }}>{fmt(vat.netPayable)}</b></span>
          </div>
        )}
        <div className="space-y-1 mb-3">
          {taxRates.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{t.name}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.ratePercent}٪{t.isDefault ? tri(lang, " · پیش‌فرض", " · default", " · Standard") : ""}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder={tri(lang, tri(lang, "نام نرخ (مثلاً VAT عمومی)", "Rate name (e.g. standard VAT)", "Name des Satzes (z. B. Regel-USt)"), "Rate name (e.g. standard VAT)", "Name des Satzes (z. B. Regel-USt)")} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder={tri(lang, tri(lang, "درصد", "Percent", "Prozent"), "Percent", "Prozent")} type="number" className="w-24 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addTaxRate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "افزودن نرخ", "Add rate", "Satz hinzufügen")}
          </button>
        </div>
      </div>
    </div>
  );
}
