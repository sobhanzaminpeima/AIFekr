"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Sparkles, Plus, Trash2, Send, CheckCircle2, Home } from "lucide-react";

interface Property {
  id: string;
  title: string;
  listingType: string;
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

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
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
              <span style={{ color: "var(--text-secondary)" }}>جمع درآمد: <b style={{ color: "#1baf7a" }}>{fmt(incomeTotal)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>جمع هزینه: <b style={{ color: "#e34948" }}>{fmt(expenseTotal)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>سود خالص: <b style={{ color: "var(--text-primary)" }}>{fmt(incomeTotal - expenseTotal)}</b></span>
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
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span>سود خالص: {fmt(s.netProfit)}</span>
                      <span>کارمزد مدیریت: {fmt(s.managementFee)}</span>
                      <span>سهم مالک: {fmt(s.ownerShare)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
