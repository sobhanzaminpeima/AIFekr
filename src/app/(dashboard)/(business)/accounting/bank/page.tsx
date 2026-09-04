"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Plus, Upload, CheckCircle2, XCircle, Landmark } from "lucide-react";

interface BankAccount { id: string; name: string; accountNumber: string | null; currency: string; }
interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  amount: number;
  status: "unmatched" | "matched" | "ignored";
  matchedType: string | null;
  matchedId: string | null;
}
interface MatchCandidate { type: string; id: string; description: string; amount: number; date: string; confidence: number; }

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

export default function BankPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [candidates, setCandidates] = useState<Record<string, MatchCandidate[]>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [accRes, txRes] = await Promise.all([
      fetch("/api/accounting/bank-accounts", { credentials: "include" }),
      fetch("/api/accounting/bank-transactions", { credentials: "include" }),
    ]);
    const accJson = await accRes.json();
    const txJson = await txRes.json();
    if (accRes.ok) {
      setAccounts(accJson.bankAccounts);
      if (!selectedAccountId && accJson.bankAccounts[0]) setSelectedAccountId(accJson.bankAccounts[0].id);
    }
    if (txRes.ok) setTransactions(txJson.transactions);
    setLoading(false);
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  async function addAccount() {
    if (!newAccountName.trim()) return toast.error("نام حساب بانکی را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/bank-accounts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAccountName }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("حساب بانکی اضافه شد");
      setNewAccountName("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در افزودن حساب بانکی");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    if (!selectedAccountId) return toast.error("ابتدا یک حساب بانکی انتخاب کنید");
    const csv = await file.text();
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/bank-transactions/import", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId: selectedAccountId, csv }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(`${j.imported} تراکنش وارد شد — ${j.unmatchedCount} مورد تطبیق‌نشده`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در وارد کردن فایل");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function getCandidates(txnId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/bank-transactions/${txnId}`, { credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setCandidates((prev) => ({ ...prev, [txnId]: j.candidates }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در یافتن پیشنهاد تطبیق");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMatch(txnId: string, candidate: MatchCandidate) {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/bank-transactions/${txnId}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "match", matchedType: candidate.type, matchedId: candidate.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("تطبیق تأیید شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تأیید تطبیق");
    } finally {
      setBusy(false);
    }
  }

  async function ignoreTxn(txnId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/bank-transactions/${txnId}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ignore" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  const unmatched = transactions.filter((t) => t.status === "unmatched");
  const resolved = transactions.filter((t) => t.status !== "unmatched");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>بانک و تطبیق</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>آپلود صورتحساب بانکی و تطبیق خودکار با پرداخت‌ها</p>
        </div>
      </div>

      {/* Bank accounts */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Landmark className="w-4 h-4" />حساب‌های بانکی</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {accounts.map((a) => (
            <button key={a.id} onClick={() => setSelectedAccountId(a.id)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: selectedAccountId === a.id ? "var(--primary)" : "var(--surface-2)", color: selectedAccountId === a.id ? "#fff" : "var(--text-secondary)" }}>
              {a.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="نام حساب بانکی جدید" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addAccount} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Plus className="w-4 h-4" />افزودن حساب
          </button>
        </div>
      </div>

      {/* CSV import */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>آپلود صورتحساب بانکی (CSV)</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>ستون‌های لازم: date, description, amount</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" disabled={busy || !selectedAccountId} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="text-sm" style={{ color: "var(--text-primary)" }} />
      </div>

      {/* Unmatched transactions */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>تراکنش‌های تطبیق‌نشده ({unmatched.length})</h2>
        {unmatched.length === 0 ? (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>همه تطبیق شده‌اند</p>
        ) : (
          <div className="space-y-2">
            {unmatched.map((t) => (
              <div key={t.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm" style={{ color: "var(--text-primary)" }}>{t.description}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{new Date(t.date).toLocaleDateString("fa-IR")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: t.amount < 0 ? "#e34948" : "#1baf7a" }}>{fmt(t.amount)}</span>
                    <button disabled={busy} onClick={() => getCandidates(t.id)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>یافتن تطبیق</button>
                    <button disabled={busy} onClick={() => ignoreTxn(t.id)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><XCircle className="w-4 h-4" /></button>
                  </div>
                </div>
                {candidates[t.id] && (
                  <div className="mt-2 space-y-1.5">
                    {candidates[t.id].length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>پیشنهادی پیدا نشد</p>
                    ) : candidates[t.id].map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs rounded-lg p-2" style={{ background: "var(--surface-1)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{c.description} — {fmt(c.amount)} ({Math.round(c.confidence * 100)}٪ تطابق)</span>
                        <button disabled={busy} onClick={() => confirmMatch(t.id, c)} className="flex items-center gap-1 px-2 py-1 rounded-md font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                          <CheckCircle2 className="w-3.5 h-3.5" />تأیید تطبیق
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>تراکنش‌های بررسی‌شده</h2>
          <div className="space-y-1.5">
            {resolved.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t.description}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: t.status === "matched" ? "rgba(27,175,122,0.12)" : "var(--surface-2)", color: t.status === "matched" ? "#1baf7a" : "var(--text-muted)" }}>
                  {t.status === "matched" ? "تطبیق‌شده" : "نادیده‌گرفته‌شده"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
