"use client";

import { useEffect, useState, useCallback } from "react";
import { Gift, Copy, Check, Users, Coins, Clock, Wallet, Send, History } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { formatNumber, toJalali } from "@/lib/utils/jalali";

interface InvitedUser {
  name: string | null;
  email: string | null;
  rewarded: boolean;
  createdAt: string;
}

interface ReferralData {
  referralCode: string | null;
  invitedCount: number;
  walletBalance: number;
  walletEarnedTotal: number;
  commissionPercent: number;
  bonusPerReferral: number;
  invitedUsers: InvitedUser[];
}

interface WalletTransaction {
  id: string; type: string; amount: number; note: string | null; createdAt: string;
}
interface PayoutRequest {
  id: string; amount: number; method: string; status: string; createdAt: string; adminNote: string | null;
}

function fmtToman(n: number, lang: string) {
  return `${formatNumber(n, lang as "fa" | "en" | "de")} ${lang === "fa" ? "تومان" : "Toman"}`;
}

const TX_TYPE_LABEL: Record<string, Record<string, string>> = {
  commission: { fa: "کمیسیون رفرال", en: "Referral commission", de: "Empfehlungsprovision" },
  redeem_at_checkout: { fa: "استفاده در خرید", en: "Used at checkout", de: "Beim Checkout verwendet" },
  payout_request: { fa: "درخواست برداشت", en: "Payout request", de: "Auszahlungsanfrage" },
  payout_rejected_refund: { fa: "بازگشت درخواست ردشده", en: "Rejected request refund", de: "Rückerstattung" },
};

export default function ReferralPage() {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [method, setMethod] = useState<"iran_sheba" | "iran_card" | "intl_card" | "paypal">("iran_sheba");
  const [amount, setAmount] = useState("");
  const [sheba, setSheba] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadReferral = useCallback(async () => {
    const r = await fetch("/api/referral/me");
    const d = await r.json();
    setData(d);
  }, []);

  const loadWallet = useCallback(async () => {
    const r = await fetch("/api/wallet/me");
    const d = await r.json();
    setTransactions(d.transactions || []);
    setPayoutRequests(d.payoutRequests || []);
  }, []);

  useEffect(() => {
    Promise.all([loadReferral(), loadWallet()]).finally(() => setLoading(false));
  }, [loadReferral, loadWallet]);

  const link = data?.referralCode && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : "";

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function submitPayoutRequest() {
    setFormError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError(tri(lang, "مبلغ نامعتبر است", "Invalid amount", "Ungültiger Betrag")); return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { amount: amt, method };
      if (method === "iran_sheba") { body.sheba = sheba; body.cardHolderName = cardHolderName; }
      if (method === "iran_card") { body.cardNumber = cardNumber; body.cardHolderName = cardHolderName; }
      if (method === "intl_card") { body.cardNumber = cardNumber; }
      if (method === "paypal") { body.paypalEmail = paypalEmail; }

      const r = await fetch("/api/wallet/payout-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowPayoutForm(false);
      setAmount(""); setSheba(""); setCardNumber(""); setCardHolderName(""); setPaypalEmail("");
      await Promise.all([loadReferral(), loadWallet()]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : tri(lang, "خطا در ثبت درخواست", "Failed to submit request", "Anfrage fehlgeschlagen"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface-0)" }}>
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }} dir={isFa ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <Gift className="w-6 h-6" style={{ color: "#10b981" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "دعوت کن، کمیسیون بگیر", "Invite & Earn", "Einladen & Verdienen")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {tri(lang,
                `دوست شما با ثبت‌نام و خرید ${formatNumber(data?.bonusPerReferral ?? 100, lang)} اعتبار رایگان می‌گیرد، و شما ${data?.commissionPercent ?? 15}٪ از مبلغ خریدش را به‌عنوان کمیسیون در ولت خود دریافت می‌کنید.`,
                `Your friend gets ${data?.bonusPerReferral ?? 100} free credits on signup + purchase, and you earn ${data?.commissionPercent ?? 15}% of their purchase as a commission in your wallet.`,
                `Ihr Freund erhält ${data?.bonusPerReferral ?? 100} kostenlose Guthaben, und Sie verdienen ${data?.commissionPercent ?? 15}% seines Kaufs als Provision in Ihrer Wallet.`)}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "دعوت‌شدگان", "Invited", "Eingeladen")}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(data?.invitedCount ?? 0, lang)}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4" style={{ color: "#10b981" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "موجودی ولت", "Wallet balance", "Wallet-Guthaben")}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{fmtToman(data?.walletBalance ?? 0, lang)}</p>
          </div>
        </div>

        {/* Wallet actions */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "موجودی ولت شما", "Your wallet", "Ihre Wallet")}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "می‌توانید هنگام خرید اشتراک از موجودی ولت به‌عنوان تخفیف استفاده کنید، یا درخواست برداشت نقدی بدهید.",
                  "You can use your wallet balance as a discount when purchasing a plan, or request a cash payout.",
                  "Sie können Ihr Wallet-Guthaben als Rabatt beim Kauf eines Plans nutzen oder eine Barauszahlung beantragen.")}
              </p>
            </div>
            <button onClick={() => setShowPayoutForm((v) => !v)} disabled={!data?.walletBalance}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ background: "var(--primary)" }}>
              <Send className="w-4 h-4" /> {tri(lang, "درخواست برداشت نقدی", "Request cash payout", "Barauszahlung anfordern")}
            </button>
          </div>

          {showPayoutForm && (
            <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder={tri(lang, "مبلغ (تومان)", "Amount (Toman)", "Betrag (Toman)")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="iran_sheba">{tri(lang, "شماره شبا (ایران)", "IBAN / Sheba (Iran)", "IBAN / Sheba (Iran)")}</option>
                <option value="iran_card">{tri(lang, "شماره کارت بانکی (ایران)", "Bank card number (Iran)", "Bankkartennummer (Iran)")}</option>
                <option value="intl_card">{tri(lang, "کارت اعتباری (خارج از ایران)", "Credit card (outside Iran)", "Kreditkarte (außerhalb Irans)")}</option>
                <option value="paypal">PayPal</option>
              </select>

              {method === "iran_sheba" && (
                <>
                  <input value={sheba} onChange={(e) => setSheba(e.target.value)} placeholder="IR000000000000000000000000" dir="ltr"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <input value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} placeholder={tri(lang, "نام صاحب حساب", "Account holder name", "Name des Kontoinhabers")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </>
              )}
              {method === "iran_card" && (
                <>
                  <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder={tri(lang, "شماره کارت ۱۶ رقمی", "16-digit card number", "16-stellige Kartennummer")} dir="ltr"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <input value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} placeholder={tri(lang, "نام صاحب کارت", "Cardholder name", "Name des Karteninhabers")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </>
              )}
              {method === "intl_card" && (
                <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder={tri(lang, "شماره کارت", "Card number", "Kartennummer")} dir="ltr"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              )}
              {method === "paypal" && (
                <input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="you@example.com" dir="ltr"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              )}

              {formError && <p className="text-xs" style={{ color: "#ef4444" }}>{formError}</p>}
              <button onClick={submitPayoutRequest} disabled={submitting}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {submitting ? "..." : tri(lang, "ثبت درخواست", "Submit request", "Anfrage senden")}
              </button>
            </div>
          )}
        </div>

        {/* Pending/past payout requests */}
        {payoutRequests.length > 0 && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "درخواست‌های برداشت", "Payout requests", "Auszahlungsanfragen")}</h2>
            <div className="space-y-2">
              {payoutRequests.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <div>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{fmtToman(p.amount, lang)}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{lang === "fa" ? toJalali(p.createdAt) : new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: p.status === "paid" ? "rgba(34,197,94,0.1)" : p.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                      color: p.status === "paid" ? "#22c55e" : p.status === "rejected" ? "#ef4444" : "#f59e0b",
                    }}>
                    {p.status === "paid" ? tri(lang, "پرداخت‌شده", "Paid", "Bezahlt") : p.status === "rejected" ? tri(lang, "رد‌شده", "Rejected", "Abgelehnt") : tri(lang, "در انتظار", "Pending", "Ausstehend")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referral link */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "لینک دعوت شما", "Your invite link", "Ihr Einladungslink")}
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white flex-shrink-0"
              style={{ background: copied ? "#10b981" : "var(--primary)" }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? tri(lang, "کپی شد", "Copied", "Kopiert") : tri(lang, "کپی", "Copy", "Kopieren")}
            </button>
          </div>
        </div>

        {/* Invited friends list */}
        {(data?.invitedUsers?.length ?? 0) > 0 && (
          <div className="rounded-2xl p-5 mt-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "دوستان دعوت‌شده", "Invited Friends", "Eingeladene Freunde")}
            </h2>
            <div className="space-y-2">
              {data!.invitedUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.name || u.email || tri(lang, "کاربر", "User", "Benutzer")}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {lang === "fa" ? toJalali(u.createdAt) : new Date(u.createdAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}
                    </p>
                  </div>
                  {u.rewarded ? (
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                      <Coins className="w-3 h-3" />
                      {tri(lang, "کمیسیون واریز شد", "Commission credited", "Provision gutgeschrieben")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}>
                      <Clock className="w-3 h-3" />
                      {tri(lang, "منتظر اولین خرید", "Awaiting first purchase", "Warterster Kauf")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallet transaction history */}
        {transactions.length > 0 && (
          <div className="rounded-2xl p-5 mt-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <History className="w-4 h-4" /> {tri(lang, "تاریخچه تراکنش‌های ولت", "Wallet transaction history", "Wallet-Transaktionsverlauf")}
            </h2>
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{TX_TYPE_LABEL[t.type]?.[lang] || t.type}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{lang === "fa" ? toJalali(t.createdAt) : new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-medium flex-shrink-0" style={{ color: t.amount >= 0 ? "#22c55e" : "#ef4444" }}>
                    {t.amount >= 0 ? "+" : ""}{fmtToman(t.amount, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
