"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface Overview {
  commissionPercent: number;
  totalOutstandingWalletBalance: number;
  totalCommissionGranted: number;
  pendingPayouts: { count: number; total: number };
  paidPayouts: { count: number; total: number };
}

interface PayoutRequest {
  id: string;
  amount: number;
  method: string;
  sheba: string | null;
  cardNumber: string | null;
  cardHolderName: string | null;
  paypalEmail: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string | null; phone: string | null; email: string | null };
}

const METHOD_LABEL: Record<string, string> = {
  iran_sheba: "شبا (ایران)",
  iran_card: "کارت بانکی (ایران)",
  intl_card: "کارت اعتباری (بین‌الملل)",
  paypal: "PayPal",
};

function fmtToman(n: number) {
  return new Intl.NumberFormat("fa-IR").format(n) + " تومان";
}

export default function AdminAffiliatePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [commissionInput, setCommissionInput] = useState("");
  const [savingCommission, setSavingCommission] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, reqRes] = await Promise.all([
        fetch("/api/admin/wallet/overview", { credentials: "include" }),
        fetch(`/api/admin/wallet/payout-requests?status=${statusFilter}`, { credentials: "include" }),
      ]);
      const ov = await ovRes.json();
      const rq = await reqRes.json();
      if (!ovRes.ok) throw new Error(ov.error || "خطا در دریافت اطلاعات");
      setOverview(ov);
      setCommissionInput(String(ov.commissionPercent));
      setRequests(rq.requests || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت اطلاعات");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function saveCommission() {
    const value = Number(commissionInput);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("درصد باید بین ۰ تا ۱۰۰ باشد");
      return;
    }
    setSavingCommission(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { referral_commission_percent: String(value) } }),
      });
      if (!r.ok) throw new Error();
      toast.success("درصد کمیسیون ذخیره شد");
      load();
    } catch {
      toast.error("خطا در ذخیره");
    } finally {
      setSavingCommission(false);
    }
  }

  async function resolve(id: string, status: "paid" | "rejected") {
    setResolvingId(id);
    try {
      const r = await fetch("/api/admin/wallet/payout-requests", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote: adminNote.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا");
      toast.success(status === "paid" ? "به‌عنوان پرداخت‌شده ثبت شد" : "درخواست رد شد و مبلغ بازگشت داده شد");
      setAdminNote("");
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت");
    } finally {
      setResolvingId(null);
    }
  }

  function methodDetail(r: PayoutRequest) {
    if (r.method === "iran_sheba") return `${r.sheba} — ${r.cardHolderName}`;
    if (r.method === "iran_card") return `${r.cardNumber} — ${r.cardHolderName}`;
    if (r.method === "intl_card") return r.cardNumber || "";
    if (r.method === "paypal") return r.paypalEmail || "";
    return "";
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Wallet className="w-6 h-6" /> افیلیت مارکتینگ و ولت
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>مدیریت کمیسیون رفرال و درخواست‌های برداشت نقدی</p>
      </div>

      {loading || !overview ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>مجموع موجودی ولت کاربران</p>
              <p className="text-lg font-bold mt-1" style={{ color: "var(--text-primary)" }}>{fmtToman(overview.totalOutstandingWalletBalance)}</p>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>مجموع کمیسیون اعطاشده</p>
              <p className="text-lg font-bold mt-1" style={{ color: "var(--text-primary)" }}>{fmtToman(overview.totalCommissionGranted)}</p>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>درخواست‌های در انتظار</p>
              <p className="text-lg font-bold mt-1" style={{ color: "#f59e0b" }}>{overview.pendingPayouts.count} · {fmtToman(overview.pendingPayouts.total)}</p>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>مجموع پرداخت‌شده</p>
              <p className="text-lg font-bold mt-1" style={{ color: "#22c55e" }}>{overview.paidPayouts.count} · {fmtToman(overview.paidPayouts.total)}</p>
            </div>
          </div>

          <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>درصد کمیسیون رفرال (از مبلغ خرید دعوت‌شده)</span>
            <input value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} type="number" min={0} max={100} step={0.5}
              className="w-24 px-3 py-1.5 rounded-lg text-sm outline-none" dir="ltr"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>٪</span>
            <button onClick={saveCommission} disabled={savingCommission}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {savingCommission ? "..." : "ذخیره"}
            </button>
          </div>

          <div className="flex gap-2">
            {["pending", "paid", "rejected"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: statusFilter === s ? "var(--primary)" : "var(--surface-2)", color: statusFilter === s ? "#fff" : "var(--text-secondary)" }}>
                {s === "pending" ? "در انتظار" : s === "paid" ? "پرداخت‌شده" : "رد‌شده"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                درخواستی در این وضعیت وجود ندارد
              </div>
            ) : requests.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.user.name || "بدون نام"} · {r.user.phone || r.user.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{METHOD_LABEL[r.method]} — {methodDetail(r)}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{fmtToman(r.amount)}</span>
                </div>
                {r.adminNote && <p className="text-xs" style={{ color: "var(--text-muted)" }}>یادداشت: {r.adminNote}</p>}
                {r.status === "pending" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="یادداشت (اختیاری)"
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    <button onClick={() => resolve(r.id, "paid")} disabled={resolvingId === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "#22c55e" }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> پرداخت شد
                    </button>
                    <button onClick={() => resolve(r.id, "rejected")} disabled={resolvingId === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      <XCircle className="w-3.5 h-3.5" /> رد کردن
                    </button>
                  </div>
                )}
                {r.status !== "pending" && (
                  <p className="text-xs flex items-center gap-1" style={{ color: r.status === "paid" ? "#22c55e" : "#ef4444" }}>
                    <Clock className="w-3 h-3" /> {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString("fa-IR") : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
