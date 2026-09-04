"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Sparkles, Plus, Trash2, Send, CheckCircle2, Home, Printer } from "lucide-react";

interface Property {
  id: string;
  title: string;
  listingType: string;
  currency: string;
}

interface LineItem {
  date: string;
  description: string;
  category: "guest_stay" | "maintenance" | "utilities" | "consumables" | "other";
  income: string;
  expense: string;
  source?: "booking" | "ai_parsed";
}

interface Statement {
  id: string;
  month: string;
  status: "draft" | "approved" | "sent";
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  managementFee: number;
  ownerShare: number;
  currency: string;
  property: { title: string };
}

interface StatementDetail extends Statement {
  entries: { id: string; date: string; description: string; category: LineItem["category"]; income: number; expense: number }[];
}

const CATEGORY_LABEL: Record<LineItem["category"], string> = {
  guest_stay: "اقامت مهمان",
  maintenance: "تعمیر و نگهداری",
  utilities: "قبوض",
  consumables: "مصرفی",
  other: "سایر",
};

const STATUS_LABEL: Record<Statement["status"], { text: string; color: string; bg: string }> = {
  draft: { text: "پیش‌نویس", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  approved: { text: "تأییدشده", color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  sent: { text: "ارسال‌شده", color: "#1baf7a", bg: "rgba(27,175,122,0.12)" },
};

// Digit formatting follows the statement's CURRENCY, never the admin's own
// UI language -- a Persian-speaking admin looking at a Lira/Dollar/Pound
// amount owed to a non-Iranian owner must see ordinary Western digits,
// exactly as that owner will see them on the same PDF; a Toman/Rial amount
// stays in Persian digits regardless of the admin's UI language.
function fmt(n: number, currency?: string): string {
  const isFaCurrency = currency === "IRT" || currency === "IRR";
  return Math.round(n).toLocaleString(isFaCurrency ? "fa-IR" : "en-US");
}

function emptyLine(): LineItem {
  return { date: new Date().toISOString().slice(0, 10), description: "", category: "other", income: "", expense: "" };
}

export default function OwnerStatementsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [assisting, setAssisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printStatement, setPrintStatement] = useState<StatementDetail | null>(null);
  const [feePercent, setFeePercent] = useState<string>("20");
  const [feeSource, setFeeSource] = useState<"property" | "workspace_default" | "hardcoded_default">("hardcoded_default");
  const [savingFee, setSavingFee] = useState(false);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const loadFeePercent = useCallback(async (pid: string) => {
    if (!pid) return;
    const res = await fetch(`/api/accounting/management-fee-rules?propertyId=${pid}`, { credentials: "include" });
    const j = await res.json();
    if (res.ok) { setFeePercent(String(j.feePercent)); setFeeSource(j.source); }
  }, []);

  useEffect(() => { loadFeePercent(propertyId); }, [propertyId, loadFeePercent]);

  async function saveFeePercent() {
    const value = Number(feePercent);
    if (!propertyId) return toast.error("ابتدا یک واحد را انتخاب کنید");
    if (isNaN(value) || value < 0 || value > 100) return toast.error("درصد کارمزد باید بین ۰ تا ۱۰۰ باشد");
    setSavingFee(true);
    try {
      const res = await fetch("/api/accounting/management-fee-rules", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, feePercent: value }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("درصد کارمزد این واحد ذخیره شد");
      setFeeSource("property");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیرهٔ درصد کارمزد");
    } finally {
      setSavingFee(false);
    }
  }

  async function openPrint(id: string) {
    try {
      const res = await fetch(`/api/accounting/owner-statements/${id}`, { credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPrintStatement(j.statement);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در بارگذاری گزارش");
    }
  }

  useEffect(() => {
    fetch("/api/crm/properties?listingType=short_term_rent", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .catch(() => {});
  }, []);

  const loadStatements = useCallback(async (pid: string) => {
    if (!pid) { setStatements([]); return; }
    const res = await fetch(`/api/accounting/owner-statements?propertyId=${pid}`, { credentials: "include" });
    const j = await res.json();
    if (res.ok) setStatements(j.statements);
  }, []);

  useEffect(() => { loadStatements(propertyId); }, [propertyId, loadStatements]);

  async function getAiSuggestions() {
    if (!propertyId) return toast.error("ابتدا یک واحد را انتخاب کنید");
    setAssisting(true);
    try {
      const res = await fetch("/api/accounting/ai/owner-statement-assist", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, month: `${month}-01`, notes: notes || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const suggested: LineItem[] = j.lines.map((l: { date: string; description: string; category: LineItem["category"]; income?: number; expense?: number; source: string }) => ({
        date: l.date.slice(0, 10),
        description: l.description,
        category: l.category,
        income: l.income ? String(l.income) : "",
        expense: l.expense ? String(l.expense) : "",
        source: l.source,
      }));
      setLines((prev) => [...prev, ...suggested]);
      toast.success(`${suggested.length} ردیف پیشنهادی اضافه شد — قبل از ساخت گزارش بازبینی کنید`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت پیشنهاد");
    } finally {
      setAssisting(false);
    }
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createStatement() {
    if (!propertyId) return toast.error("ابتدا یک واحد را انتخاب کنید");
    if (lines.length === 0) return toast.error("حداقل یک ردیف لازم است");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/owner-statements", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId, month: `${month}-01`,
          currency: selectedProperty?.currency || "IRT",
          entries: lines.map((l) => ({ date: l.date, description: l.description, category: l.category, income: Number(l.income) || 0, expense: Number(l.expense) || 0 })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("گزارش تسویه ساخته شد");
      setLines([]);
      setNotes("");
      loadStatements(propertyId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت گزارش");
    } finally {
      setBusy(false);
    }
  }

  async function statementAction(id: string, action: "approve" | "send") {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/owner-statements/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(action === "approve" ? "گزارش تأیید شد" : "برای مالک ارسال شد");
      loadStatements(propertyId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  const incomeTotal = lines.reduce((s, l) => s + (Number(l.income) || 0), 0);
  const expenseTotal = lines.reduce((s, l) => s + (Number(l.expense) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>گزارش تسویه مالک (اجاره کوتاه‌مدت)</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>با کمک دستیار هوشمند، ردیف‌های ماهانه را پیشنهاد بگیرید و پیش از ارسال بازبینی کنید</p>
        </div>
      </div>

      {/* Property + month picker */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="px-3 py-2 rounded-lg text-sm flex-1 min-w-[180px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">انتخاب واحد اجاره کوتاه‌مدت</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>

        {propertyId && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>درصد کارمزد مدیریت این واحد:</span>
            <input value={feePercent} onChange={(e) => setFeePercent(e.target.value)} type="number" min="0" max="100" className="w-20 px-2 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span style={{ color: "var(--text-secondary)" }}>٪</span>
            <button disabled={savingFee} onClick={saveFeePercent} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>ذخیره</button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {feeSource === "property" ? "(اختصاصی این واحد)" : feeSource === "workspace_default" ? "(پیش‌فرض کارگاه)" : "(پیش‌فرض سیستم — ۲۰٪)"}
            </span>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="یادداشت آزاد این ماه (اختیاری) — مثلاً: «آب و برق ۲۰۰ هزار تومان، تمیزکاری ۵۰۰ هزار تومان»"
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm mb-3"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />

        <div className="flex gap-2">
          <button disabled={assisting || !propertyId} onClick={getAiSuggestions} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Sparkles className="w-4 h-4" />{assisting ? "در حال دریافت پیشنهاد..." : "دریافت پیشنهاد هوشمند"}
          </button>
          <button onClick={() => setLines((prev) => [...prev, emptyLine()])} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Plus className="w-4 h-4" />افزودن ردیف دستی
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>ردیف‌های «اقامت مهمان» مستقیماً از رزروهای ثبت‌شده محاسبه می‌شوند (عدد دقیق، نه تخمین). ردیف‌های استخراج‌شده از یادداشت باید قبل از ساخت گزارش بازبینی شوند.</p>
      </div>

      {/* Line items */}
      {lines.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>ردیف‌های ماه</h2>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="rounded-xl p-3 flex flex-wrap gap-2 items-center" style={{ background: "var(--surface-2)" }}>
                <input type="date" value={l.date} onChange={(e) => updateLine(i, { date: e.target.value })} className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="شرح" className="flex-1 min-w-[140px] px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <select value={l.category} onChange={(e) => updateLine(i, { category: e.target.value as LineItem["category"] })} className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input value={l.income} onChange={(e) => updateLine(i, { income: e.target.value })} placeholder="درآمد" type="number" className="w-24 px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "#1baf7a" }} />
                <input value={l.expense} onChange={(e) => updateLine(i, { expense: e.target.value })} placeholder="هزینه" type="number" className="w-24 px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "#e34948" }} />
                {l.source === "ai_parsed" && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(237,161,0,0.12)", color: "#eda100" }}>پیشنهاد AI</span>}
                {l.source === "booking" && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(27,175,122,0.12)", color: "#1baf7a" }}>از رزرو</span>}
                <button onClick={() => removeLine(i)} className="p-1.5 rounded-lg" style={{ color: "#e34948" }}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex gap-4">
              <span style={{ color: "var(--text-secondary)" }}>جمع درآمد: <b style={{ color: "#1baf7a" }}>{fmt(incomeTotal, selectedProperty?.currency)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>جمع هزینه: <b style={{ color: "#e34948" }}>{fmt(expenseTotal, selectedProperty?.currency)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>سود خالص: <b style={{ color: "var(--text-primary)" }}>{fmt(incomeTotal - expenseTotal, selectedProperty?.currency)}</b></span>
            </div>
            <button disabled={busy} onClick={createStatement} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>ساخت گزارش تسویه</button>
          </div>
        </div>
      )}

      {/* Existing statements */}
      {propertyId && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Home className="w-4 h-4" />تاریخچه گزارش‌های این واحد</h2>
          {statements.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>هنوز گزارشی ساخته نشده</p>
          ) : (
            <div className="space-y-2">
              {statements.map((s) => {
                const st = STATUS_LABEL[s.status];
                return (
                  <div key={s.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{new Date(s.month).toLocaleDateString("fa-IR", { year: "numeric", month: "long" })}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "draft" && (
                          <button disabled={busy} onClick={() => statementAction(s.id, "approve")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />تأیید
                          </button>
                        )}
                        {s.status === "approved" && (
                          <button disabled={busy} onClick={() => statementAction(s.id, "send")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#1baf7a", color: "#fff" }}>
                            <Send className="w-3.5 h-3.5" />ارسال به مالک
                          </button>
                        )}
                        <button onClick={() => openPrint(s.id)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }} title="چاپ گزارش"><Printer className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span>سود خالص: {fmt(s.netProfit, s.currency)}</span>
                      <span>کارمزد مدیریت: {fmt(s.managementFee, s.currency)}</span>
                      <span>سهم مالک: {fmt(s.ownerShare, s.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {printStatement && <OwnerStatementPrintModal statement={printStatement} onClose={() => setPrintStatement(null)} />}
    </div>
  );
}

function OwnerStatementPrintModal({ statement, onClose }: { statement: StatementDetail; onClose: () => void }) {
  const monthLabel = new Date(statement.month).toLocaleDateString("fa-IR", { year: "numeric", month: "long" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>چاپ / ذخیره PDF</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>بستن</button>
      </div>
      <div dir="rtl" className="w-full max-w-2xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none" style={{ background: "#fff", color: "#111" }}>
        <div className="border-b pb-3">
          <h2 className="text-lg font-bold">{statement.property.title}</h2>
          <span className="text-xs text-gray-500">{monthLabel}</span>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500"><th className="text-right py-1">تاریخ</th><th className="text-right py-1">شرح</th><th className="text-left py-1">درآمد</th><th className="text-left py-1">هزینه</th></tr></thead>
          <tbody>
            {statement.entries.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-1">{new Date(e.date).toLocaleDateString("fa-IR")}</td>
                <td className="py-1">{e.description}</td>
                <td className="py-1 text-left text-green-700">{e.income ? fmt(e.income, statement.currency) : ""}</td>
                <td className="py-1 text-left text-red-700">{e.expense ? fmt(e.expense, statement.currency) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-sm mt-4">
          <tbody>
            <tr className="border-b"><td className="py-2 text-gray-500">سود خالص</td><td className="py-2 text-left font-bold">{fmt(statement.netProfit, statement.currency)} {statement.currency}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">کارمزد مدیریت</td><td className="py-2 text-left">{fmt(statement.managementFee, statement.currency)} {statement.currency}</td></tr>
            <tr><td className="py-2 font-bold">سهم مالک</td><td className="py-2 text-left font-bold" style={{ color: "#ea580c" }}>{fmt(statement.ownerShare, statement.currency)} {statement.currency}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
