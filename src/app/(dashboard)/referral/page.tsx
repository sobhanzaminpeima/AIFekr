"use client";

import { useEffect, useState, useCallback } from "react";
import { Gift, Copy, Check, Users, Coins, Clock, Wallet, Send, History } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { formatNumber, toJalali } from "@/lib/utils/jalali";
import type { FxRates } from "@/lib/utils/currency";

interface InvitedUser {
  name: string | null;
  email: string | null;
  rewarded: boolean;
  createdAt: string;
}

interface ReferralData {
  currency?: string | null;
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

// Wallet amounts are stored/processed in Toman on the backend (real cash),
// but displayed converted to the viewer's preferred currency using the same
// live FX rates the pricing pages use, not just swapping the unit label.
// An explicit account-level currency (Settings -> Display currency) wins;
// with none set, it falls back to the old per-language default -- USD for
// English, EUR for German, Toman for Persian -- so existing users see no change.
function fmtWallet(tomanAmount: number, lang: "fa" | "en" | "de" | "tr", rates: FxRates | null, currency?: string | null): string {
  const effective = currency || (lang === "fa" ? "IRT" : lang === "de" ? "EUR" : "USD");
  if (effective === "IRT" || !rates) {
    return `${formatNumber(tomanAmount, lang)} ${lang === "fa" ? "تومان" : "Toman"}`;
  }
  const usd = tomanAmount / rates.usdToToman;
  if (effective === "USD") return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const eur = usd * rates.usdToEur;
  return `€${eur.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
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
  const [tab, setTab] = useState<"invite" | "stats" | "wallet" | "transactions" | "payout">("invite");
  const [fxRates, setFxRates] = useState<FxRates | null>(null);

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
    // Always fetch -- previously skipped for Persian, but a Persian-language
    // user can still explicitly pick USD/EUR as their display currency in
    // Settings, and fmtWallet needs live rates for that case too.
    fetch("/api/fx-rate").then((r) => r.json()).then(setFxRates).catch(() => {});
  }, [loadReferral, loadWallet, lang]);

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

  const invited = data?.invitedUsers ?? [];
  const rewardedCount = invited.filter((u) => u.rewarded).length;
  const pendingCount = invited.length - rewardedCount;

  const TABS = [
    { id: "invite", label: tri(lang, "دعوت دوستان", "Invite Friends", "Freunde einladen"), icon: Gift },
    { id: "stats", label: tri(lang, "آمار و دوستان", "Stats & Friends", "Statistiken & Freunde"), icon: Users },
    { id: "wallet", label: tri(lang, "کیف پول معرفی", "Referral Wallet", "Empfehlungs-Wallet"), icon: Wallet },
    { id: "transactions", label: tri(lang, "تراکنش‌ها", "Transactions", "Transaktionen"), icon: History },
    { id: "payout", label: tri(lang, "برداشت", "Payout", "Auszahlung"), icon: Send },
  ] as const;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }} dir={isFa ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
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

        {/* Horizontal tab bar */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.id}
              onClick={() => setTab(tabDef.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: tab === tabDef.id ? "var(--text-primary)" : "var(--surface-1)",
                color: tab === tabDef.id ? "var(--surface-0)" : "var(--text-secondary)",
                border: `1px solid ${tab === tabDef.id ? "var(--text-primary)" : "var(--border)"}`,
              }}
            >
              <tabDef.icon className="w-4 h-4" />
              {tabDef.label}
            </button>
          ))}
        </div>

        {/* ── Tab: دعوت دوستان ───────────────────────────────────────── */}
        {tab === "invite" && (
          <div className="rounded-2xl p-5" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
              {tri(lang, "برنامه فعال", "Active program", "Aktives Programm")}
            </span>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "دوستت را به AiFekr دعوت کن", "Invite your friend to AiFekr", "Lade deinen Freund zu AiFekr ein")}
            </h2>
            <div className="flex gap-2 mb-2">
              <input readOnly value={link} className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white flex-shrink-0"
                style={{ background: copied ? "#10b981" : "var(--primary)" }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? tri(lang, "کپی شد", "Copied", "Kopiert") : tri(lang, "کپی لینک", "Copy link", "Link kopieren")}
              </button>
            </div>
            {data?.referralCode && (
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{tri(lang, "کد شما:", "Your code:", "Ihr Code:")} {data.referralCode}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmtWallet(data?.walletEarnedTotal ?? 0, lang, fxRates, data?.currency)}</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "کل پاداش ایجادشده", "Total rewards earned", "Gesamte Belohnungen")}</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(rewardedCount, lang)}</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "دوست واجد شرایط", "Qualified friends", "Qualifizierte Freunde")}</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(invited.length, lang)}</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "ثبت‌نام‌ها", "Signups", "Anmeldungen")}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: آمار و دوستان ─────────────────────────────────────── */}
        {tab === "stats" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: tri(lang, "در انتظار", "Pending", "Ausstehend"), value: pendingCount, dot: "#f59e0b" },
                { label: tri(lang, "واجد شرایط", "Qualified", "Qualifiziert"), value: rewardedCount, dot: "#22c55e" },
                { label: tri(lang, "ثبت‌نام‌ها", "Signups", "Anmeldungen"), value: invited.length, dot: "var(--text-muted)" },
                { label: tri(lang, "دعوت‌شدگان", "Invited", "Eingeladen"), value: data?.invitedCount ?? 0, dot: "var(--primary)" },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                    <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(s.value, lang)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {tri(lang, "دوستان دعوت‌شده", "Invited Friends", "Eingeladene Freunde")}
              </h2>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "برای حفظ حریم خصوصی فقط نام/ایمیل دوستتان نمایش داده می‌شود.", "For privacy, only your friend's name/email is shown.", "Aus Datenschutzgründen wird nur Name/E-Mail Ihres Freundes angezeigt.")}
              </p>
              {invited.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "در این صفحه هنوز موردی وجود ندارد.", "Nothing here yet.", "Hier gibt es noch nichts.")}
                </p>
              ) : (
                <div className="space-y-2">
                  {invited.map((u, i) => (
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
                          {tri(lang, "منتظر اولین خرید", "Awaiting first purchase", "Wartet auf ersten Kauf")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Tab: کیف پول معرفی ─────────────────────────────────────── */}
        {tab === "wallet" && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4" style={{ color: "#10b981" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "موجودی قابل‌استفاده", "Available balance", "Verfügbares Guthaben")}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{fmtWallet(data?.walletBalance ?? 0, lang, fxRates, data?.currency)}</p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "کل ایجادشده", "Total earned", "Insgesamt verdient")}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{fmtWallet(data?.walletEarnedTotal ?? 0, lang, fxRates, data?.currency)}</p>
              </div>
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tri(lang, "استفاده از موجودی", "Using your balance", "Guthaben verwenden")}</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "می‌توانید هنگام خرید اشتراک از موجودی ولت به‌عنوان تخفیف استفاده کنید، یا از تب «برداشت» درخواست برداشت نقدی بدهید.",
                  "You can use your wallet balance as a discount when purchasing a plan, or request a cash payout from the Payout tab.",
                  "Sie können Ihr Wallet-Guthaben als Rabatt beim Kauf eines Plans nutzen oder im Tab „Auszahlung“ eine Barauszahlung beantragen.")}
              </p>
            </div>
          </>
        )}

        {/* ── Tab: تراکنش‌ها ─────────────────────────────────────────── */}
        {tab === "transactions" && (
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <History className="w-4 h-4" /> {tri(lang, "همه تراکنش‌ها", "All transactions", "Alle Transaktionen")}
            </h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "هنوز تراکنشی ثبت نشده است.", "No transactions yet.", "Noch keine Transaktionen.")}
              </p>
            ) : (
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                    <div className="min-w-0">
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{TX_TYPE_LABEL[t.type]?.[lang] || t.type}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{lang === "fa" ? toJalali(t.createdAt) : new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: t.amount >= 0 ? "#22c55e" : "#ef4444" }}>
                      {t.amount >= 0 ? "+" : ""}{fmtWallet(t.amount, lang, fxRates, data?.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: برداشت ────────────────────────────────────────────── */}
        {tab === "payout" && (
          <>
            <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "درخواست برداشت جدید", "New payout request", "Neue Auszahlungsanfrage")}</h2>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {tri(lang, "موجودی قابل‌برداشت:", "Withdrawable balance:", "Verfügbares Guthaben:")} {fmtWallet(data?.walletBalance ?? 0, lang, fxRates, data?.currency)}
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

            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "درخواست‌های برداشت", "Payout requests", "Auszahlungsanfragen")}</h2>
              {payoutRequests.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Clock className="w-8 h-8 opacity-30" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز درخواستی ثبت نکرده‌اید.", "You haven't made a request yet.", "Sie haben noch keine Anfrage gestellt.")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payoutRequests.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                      <div>
                        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{fmtWallet(p.amount, lang, fxRates, data?.currency)}</p>
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
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
