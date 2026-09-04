"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Plus, CheckCircle2, XCircle, Wallet, Building2, Sparkles } from "lucide-react";

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
}

const STATUS_LABEL: Record<Expense["status"], { text: string; color: string; bg: string }> = {
  pending_approval: { text: "در انتظار تأیید", color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  approved: { text: "تأییدشده", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  rejected: { text: "رد شده", color: "#e34948", bg: "rgba(227,73,72,0.12)" },
  paid: { text: "پرداخت‌شده", color: "#1baf7a", bg: "rgba(27,175,122,0.12)" },
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

export default function ExpensesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accountCode, setAccountCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [vendorId, setVendorId] = useState("");

  const [proposals, setProposals] = useState<Record<string, { id: string; suggestedAccountCode: string; reasoning: string }>>({});

  const [newVendorName, setNewVendorName] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);

  const load = useCallback(async () => {
    const [accRes, venRes, expRes] = await Promise.all([
      fetch("/api/accounting/accounts", { credentials: "include" }),
      fetch("/api/accounting/vendors", { credentials: "include" }),
      fetch("/api/accounting/expenses", { credentials: "include" }),
    ]);
    const accJson = await accRes.json();
    const venJson = await venRes.json();
    const expJson = await expRes.json();
    if (accRes.ok) setAccounts(accJson.accounts.filter((a: Account) => a.type === "expense"));
    if (venRes.ok) setVendors(venJson.vendors);
    if (expRes.ok) setExpenses(expJson.expenses);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addExpense() {
    if (!accountCode) return toast.error("حساب هزینه را انتخاب کنید");
    if (!amount || Number(amount) <= 0) return toast.error("مبلغ را وارد کنید");
    if (!description.trim()) return toast.error("توضیحات را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, amount: Number(amount), description, vendorId: vendorId || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("هزینه ثبت شد");
      setAmount(""); setDescription(""); setVendorId(""); setAccountCode("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت هزینه");
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
      toast.success("انجام شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
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
      toast.error(e instanceof Error ? e.message : "خطا در دریافت پیشنهاد");
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
      toast.success("دسته‌بندی اعمال شد");
      setProposals((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function addVendor() {
    if (!newVendorName.trim()) return toast.error("نام تأمین‌کننده را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/vendors", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newVendorName }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("تأمین‌کننده اضافه شد");
      setNewVendorName("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در افزودن تأمین‌کننده");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>هزینه‌ها و تأمین‌کنندگان</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>ثبت، تأیید و پرداخت هزینه‌ها</p>
        </div>
      </div>

      {/* Vendors */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <button className="w-full flex items-center justify-between" onClick={() => setShowVendorForm(!showVendorForm)}>
          <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Building2 className="w-4 h-4" />تأمین‌کنندگان ({vendors.length})</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{showVendorForm ? "بستن" : "افزودن"}</span>
        </button>
        {showVendorForm && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="نام تأمین‌کننده" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button disabled={busy} onClick={addVendor} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
              <Plus className="w-4 h-4" />افزودن
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
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>ثبت هزینه جدید</h2>
        <div className="flex flex-wrap gap-2">
          <select value={accountCode} onChange={(e) => setAccountCode(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">حساب هزینه</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">تأمین‌کننده (اختیاری)</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ (تومان)" type="number" className="w-36 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addExpense} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />ثبت
          </button>
        </div>
      </div>

      {/* Expenses list */}
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>هنوز هزینه‌ای ثبت نشده</div>
        ) : expenses.map((e) => {
          const st = STATUS_LABEL[e.status];
          const proposal = proposals[e.id];
          return (
            <div key={e.id} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.description}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>حساب {e.accountCode} {e.vendor ? `— ${e.vendor.name}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(e.amount)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                  {e.status === "pending_approval" && (
                    <>
                      <button disabled={busy} onClick={() => askAiCategory(e.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }} title="پیشنهاد دسته‌بندی هوشمند"><Sparkles className="w-4 h-4" /></button>
                      <button disabled={busy} onClick={() => expenseAction(e.id, "approve")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "#1baf7a" }} title="تأیید"><CheckCircle2 className="w-4 h-4" /></button>
                      <button disabled={busy} onClick={() => expenseAction(e.id, "reject")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "#e34948" }} title="رد"><XCircle className="w-4 h-4" /></button>
                    </>
                  )}
                  {e.status === "approved" && (
                    <button disabled={busy} onClick={() => expenseAction(e.id, "pay")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#1baf7a", color: "#fff" }}>
                      <Wallet className="w-3.5 h-3.5" />ثبت پرداخت
                    </button>
                  )}
                </div>
              </div>
              {proposal && (
                <div className="mt-2 text-xs rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>پیشنهاد: حساب {proposal.suggestedAccountCode} — {proposal.reasoning}</span>
                  <button disabled={busy} onClick={() => approveCategoryProposal(e.id)} className="mr-2 px-2 py-0.5 rounded-md" style={{ background: "var(--primary)", color: "#fff" }}>اعمال</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
