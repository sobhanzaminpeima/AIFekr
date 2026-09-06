"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Plus, CheckCircle2, XCircle, Wallet, Building2, Sparkles } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";
import AccountingNav from "@/components/accounting/AccountingNav";

interface Account { code: string; name: string; type: string; }
interface Vendor { id: string; name: string; phone: string | null; email: string | null; }
interface Expense {
  id: string;
  vendorId: string | null;
  accountCode: string;
  amount: number;
  description: string;
  status: "pending_approval" | "approved" | "rejected" | "paid";
  expenseDate: string;
  vendor: Vendor | null;
  property: { id: string; title: string } | null;
}

interface PropertyOption { id: string; title: string }

const STATUS_STYLE: Record<Expense["status"], { color: string; bg: string }> = {
  pending_approval: { color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  approved: { color: "var(--text-secondary)", bg: "var(--surface-2)" },
  rejected: { color: "var(--neg)", bg: "rgba(227,73,72,0.12)" },
  paid: { color: "var(--pos)", bg: "rgba(27,175,122,0.12)" },
};

function statusLabel(status: Expense["status"], lang: Lang): string {
  switch (status) {
    case "pending_approval": return tri(lang, "در انتظار تأیید", "Pending approval", "Zur Genehmigung");
    case "approved": return tri(lang, "تأییدشده", "Approved", "Genehmigt");
    case "rejected": return tri(lang, "رد شده", "Rejected", "Abgelehnt");
    default: return tri(lang, "پرداخت‌شده", "Paid", "Bezahlt");
  }
}

export default function ExpensesPage() {
  const { lang, dir, fmtNum: fmt } = useAccountingLocale();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accountCode, setAccountCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState("");
  // Attaching a cost to a unit is what makes "what has this property cost me?"
  // answerable, and what lets an owner statement pull its expense lines instead
  // of having them retyped every month.
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  const [proposals, setProposals] = useState<Record<string, { id: string; suggestedAccountCode: string; reasoning: string }>>({});

  const [newVendorName, setNewVendorName] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);

  const load = useCallback(async () => {
    const [accRes, venRes, expRes, propRes] = await Promise.all([
      fetch("/api/accounting/accounts", { credentials: "include" }),
      fetch("/api/accounting/vendors", { credentials: "include" }),
      fetch("/api/accounting/expenses", { credentials: "include" }),
      fetch("/api/crm/properties", { credentials: "include" }),
    ]);
    const accJson = await accRes.json();
    const venJson = await venRes.json();
    const expJson = await expRes.json();
    const propJson = await propRes.json().catch(() => ({ properties: [] }));
    if (propRes.ok) setProperties((propJson.properties || []).map((x: PropertyOption) => ({ id: x.id, title: x.title })));
    if (accRes.ok) setAccounts(accJson.accounts.filter((a: Account) => a.type === "expense"));
    if (venRes.ok) setVendors(venJson.vendors);
    if (expRes.ok) setExpenses(expJson.expenses);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addExpense() {
    if (!accountCode) return toast.error(tri(lang, "حساب هزینه را انتخاب کنید", "Select an expense account", "Wählen Sie ein Aufwandskonto"));
    if (!amount || Number(amount) <= 0) return toast.error(tri(lang, "مبلغ را وارد کنید", "Enter an amount", "Betrag eingeben"));
    if (!description.trim()) return toast.error(tri(lang, "توضیحات را وارد کنید", "Enter a description", "Beschreibung eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, amount: Number(amount), description, vendorId: vendorId || undefined, propertyId: propertyId || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "هزینه ثبت شد", "Expense recorded", "Ausgabe erfasst"));
      setAmount(""); setDescription(""); setVendorId(""); setAccountCode("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ثبت هزینه", "Failed to record the expense", "Ausgabe konnte nicht erfasst werden"));
    } finally {
      setBusy(false);
    }
  }

  async function expenseAction(id: string, action: "approve" | "reject" | "pay") {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/expenses/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "انجام شد", "Done", "Erledigt"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  async function askAiCategory(expenseId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/ai/proposals", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const payload = JSON.parse(j.proposal.payload);
      setProposals((prev) => ({ ...prev, [expenseId]: { id: j.proposal.id, ...payload } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در دریافت پیشنهاد", "Failed to get a suggestion", "Vorschlag konnte nicht geladen werden"));
    } finally {
      setBusy(false);
    }
  }

  async function approveCategoryProposal(expenseId: string) {
    const p = proposals[expenseId];
    if (!p) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/ai/proposals/${p.id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "دسته‌بندی اعمال شد", "Category applied", "Kategorie übernommen"));
      setProposals((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  async function addVendor() {
    if (!newVendorName.trim()) return toast.error(tri(lang, "نام تأمین‌کننده را وارد کنید", "Enter the vendor name", "Lieferantenname eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/vendors", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVendorName }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "تأمین‌کننده اضافه شد", "Vendor added", "Lieferant hinzugefügt"));
      setNewVendorName("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در افزودن تأمین‌کننده", "Failed to add the vendor", "Lieferant konnte nicht hinzugefügt werden"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <AccountingNav />
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "هزینه‌ها و تأمین‌کنندگان", "Expenses & vendors", "Ausgaben & Lieferanten")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "ثبت، تأیید و پرداخت هزینه‌ها", "Record, approve and pay expenses", "Ausgaben erfassen, genehmigen und bezahlen")}</p>
        </div>
      </div>

      {/* Vendors */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <button className="w-full flex items-center justify-between" onClick={() => setShowVendorForm(!showVendorForm)}>
          <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Building2 className="w-4 h-4" />{tri(lang, "تأمین‌کنندگان", "Vendors", "Lieferanten")} ({vendors.length})</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{showVendorForm ? tri(lang, "بستن", "Close", "Schließen") : tri(lang, "افزودن", "Add", "Hinzufügen")}</span>
        </button>
        {showVendorForm && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder={tri(lang, "نام تأمین‌کننده", "Vendor name", "Lieferantenname")} className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button disabled={busy} onClick={addVendor} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
              <Plus className="w-4 h-4" />{tri(lang, "افزودن", "Add", "Hinzufügen")}
            </button>
          </div>
        )}
        {vendors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {vendors.map((v) => <span key={v.id} className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{v.name}</span>)}
          </div>
        )}
      </div>

      {/* Add expense */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "ثبت هزینه جدید", "Record a new expense", "Neue Ausgabe erfassen")}</h2>
        <div className="flex flex-wrap gap-2">
          <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "حساب هزینه", "Expense account", "Aufwandskonto")}</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "تأمین‌کننده (اختیاری)", "Vendor (optional)", "Lieferant (optional)")}</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="px-3 py-2 rounded-lg text-sm max-w-[220px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "بدون ملک — هزینهٔ دفتر", "No property — agency cost", "Kein Objekt — Agenturkosten")}</option>
            {properties.map((pr) => <option key={pr.id} value={pr.id}>{pr.title}</option>)}
          </select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tri(lang, "مبلغ (تومان)", "Amount (Toman)", "Betrag (Toman)")} type="number" className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tri(lang, "توضیحات", "Description", "Beschreibung")} className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addExpense} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "ثبت", "Record", "Erfassen")}
          </button>
        </div>
      </div>

      {/* Expenses list */}
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{tri(lang, "هنوز هزینه‌ای ثبت نشده", "No expenses recorded yet", "Noch keine Ausgaben erfasst")}</div>
        ) : expenses.map((e) => {
          const st = STATUS_STYLE[e.status];
          const proposal = proposals[e.id];
          return (
            <div key={e.id} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.description}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{tri(lang, "حساب", "Account", "Konto")} {e.accountCode} {e.vendor ? `— ${e.vendor.name}` : ""}</div>
                  {e.property && (
                    <div className="inline-flex items-center gap-1 text-[11px] mt-1 px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      {e.property.title}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(e.amount)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{statusLabel(e.status, lang)}</span>
                  {e.status === "pending_approval" && (
                    <>
                      <button disabled={busy} onClick={() => askAiCategory(e.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }} title={tri(lang, "پیشنهاد دسته‌بندی هوشمند", "Suggest a category with AI", "Kategorie per KI vorschlagen")}><Sparkles className="w-4 h-4" /></button>
                      <button disabled={busy} onClick={() => expenseAction(e.id, "approve")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--pos)" }} title={tri(lang, "تأیید", "Approve", "Genehmigen")}><CheckCircle2 className="w-4 h-4" /></button>
                      <button disabled={busy} onClick={() => expenseAction(e.id, "reject")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--neg)" }} title={tri(lang, "رد", "Reject", "Ablehnen")}><XCircle className="w-4 h-4" /></button>
                    </>
                  )}
                  {e.status === "approved" && (
                    <button disabled={busy} onClick={() => expenseAction(e.id, "pay")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--pos)", color: "#fff" }}>
                      <Wallet className="w-3.5 h-3.5" />{tri(lang, "ثبت پرداخت", "Record payment", "Zahlung erfassen")}
                    </button>
                  )}
                </div>
              </div>
              {proposal && (
                <div className="mt-2 text-xs rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{tri(lang, "پیشنهاد: حساب", "Suggested account:", "Vorgeschlagenes Konto:")} {proposal.suggestedAccountCode} — {proposal.reasoning}</span>
                  <button disabled={busy} onClick={() => approveCategoryProposal(e.id)} className="ms-2 px-2 py-0.5 rounded-md" style={{ background: "var(--primary)", color: "#fff" }}>{tri(lang, "اعمال", "Apply", "Übernehmen")}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
