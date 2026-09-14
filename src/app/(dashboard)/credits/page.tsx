"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, Loader2, ShoppingCart, History } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation, tri } from "@/lib/i18n";
import { formatNumber, toJalali } from "@/lib/utils/jalali";

interface CreditTier {
  id: string;
  creditsAmount: number;
  priceToman: number;
  discountPercent: number;
  badge: string | null;
}

interface Profile {
  credits: number;
  displayCredits: number;
  plan: string;
}

const PLAN_COLOR: Record<string, string> = { FREE: "#71717a", BASIC: "#3b82f6", PRO: "#ea580c", TEAM: "#8b5cf6" };
const PLAN_LABEL: Record<string, Record<string, string>> = {
  FREE: { fa: "رایگان", en: "Free", de: "Kostenlos" },
  BASIC: { fa: "پایه", en: "Basic", de: "Basis" },
  PRO: { fa: "حرفه‌ای", en: "Pro", de: "Pro" },
  TEAM: { fa: "تیمی", en: "Team", de: "Team" },
};

const BADGE_LABEL: Record<string, Record<string, string>> = {
  best_value: { fa: "پرفروش‌ترین", en: "Best value", de: "Bestseller" },
  most_discount: { fa: "بیشترین تخفیف", en: "Most discount", de: "Größter Rabatt" },
};

export default function CreditsPage() {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const [tiers, setTiers] = useState<CreditTier[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingTierId, setBuyingTierId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tiersRes, profileRes] = await Promise.all([
      fetch("/api/credits/tiers", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/user/profile", { credentials: "include" }).then((r) => r.json()),
    ]);
    setTiers(tiersRes.tiers || []);
    setProfile(profileRes.user || null);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") toast.success(tri(lang, "خرید کردیت با موفقیت انجام شد", "Credit purchase successful", "Guthabenkauf erfolgreich"));
    if (params.get("payment") === "failed") toast.error(tri(lang, "پرداخت ناموفق بود", "Payment failed", "Zahlung fehlgeschlagen"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function buyTier(tierId: string) {
    setBuyingTierId(tierId);
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tierId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.paymentUrl;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در شروع پرداخت", "Failed to start payment", "Zahlung konnte nicht gestartet werden"));
      setBuyingTierId(null);
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
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.12)" }}>
            <Coins className="w-6 h-6" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "کیف پول کردیت", "Credit Wallet", "Guthaben-Wallet")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "کردیت شما برای همه ابزارهای تولید محتوای AiFekr استفاده می‌شود.", "Your credits are used across all AiFekr content-generation tools.", "Ihr Guthaben wird für alle AiFekr-Content-Tools verwendet.")}
            </p>
          </div>
        </div>

        {/* Balance -- same figure the sidebar shows (team pool if applicable, see /api/user/profile), plus the account's plan badge shown right next to it, matching the sidebar. */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "کردیت قابل‌استفاده امروز", "Available credits today", "Heute verfügbares Guthaben")}</p>
            {profile?.plan && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: (PLAN_COLOR[profile.plan] || PLAN_COLOR.FREE) + "22", color: PLAN_COLOR[profile.plan] || PLAN_COLOR.FREE }}>
                {PLAN_LABEL[profile.plan]?.[lang] || profile.plan}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6" style={{ color: "var(--primary)" }} />
            <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(profile?.displayCredits ?? profile?.credits ?? 0, lang)}</span>
          </div>
        </div>

        {/* Tiers */}
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "خرید کردیت", "Buy Credits", "Guthaben kaufen")}</h2>
        {tiers.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
            {tri(lang, "در حال حاضر تعرفه‌ای برای خرید موجود نیست.", "No purchase tiers are available right now.", "Derzeit sind keine Kaufstufen verfügbar.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {tiers.map((t) => {
              const perCredit = Math.round(t.priceToman / t.creditsAmount);
              const listPrice = t.discountPercent > 0 ? Math.round(t.priceToman / (1 - t.discountPercent / 100)) : null;
              return (
                <div key={t.id} className="relative rounded-2xl p-4 flex flex-col"
                  style={{
                    background: "var(--surface-1)",
                    border: `1px solid ${t.badge ? "var(--primary)" : "var(--border)"}`,
                  }}>
                  {t.badge && (
                    <span className="absolute -top-2.5 self-center text-[11px] font-medium px-2.5 py-0.5 rounded-full text-white" style={{ background: "var(--primary)" }}>
                      {BADGE_LABEL[t.badge]?.[lang] || t.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Coins className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(t.creditsAmount, lang)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {formatNumber(t.creditsAmount, lang)} {tri(lang, "کردیت قابل استفاده", "usable credits", "nutzbare Guthaben")}
                  </p>
                  <div className="mt-3">
                    {listPrice && (
                      <p className="text-xs line-through" style={{ color: "var(--text-muted)" }}>{formatNumber(listPrice, lang)} {tri(lang, "تومان", "Toman", "Toman")}</p>
                    )}
                    <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(t.priceToman, lang)} {tri(lang, "تومان", "Toman", "Toman")}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {tri(lang, `هر کردیت ${formatNumber(perCredit, lang)} تومان`, `${formatNumber(perCredit, lang)} Toman/credit`, `${formatNumber(perCredit, lang)} Toman/Guthaben`)}
                    </p>
                  </div>
                  <button
                    onClick={() => buyTier(t.id)}
                    disabled={buyingTierId === t.id}
                    className="mt-4 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: t.badge ? "var(--primary)" : "var(--surface-2)", color: t.badge ? "white" : "var(--text-primary)" }}
                  >
                    {buyingTierId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                    {tri(lang, "خرید", "Buy", "Kaufen")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <CreditPurchaseHistory lang={lang} />
        <CreditUsageHistory lang={lang} />
      </div>
    </div>
  );
}

const TX_TYPE_LABEL: Record<string, Record<string, string>> = {
  purchase: { fa: "خرید کردیت", en: "Credit purchase", de: "Guthabenkauf" },
};

function CreditPurchaseHistory({ lang }: { lang: "fa" | "en" | "de" }) {
  const [payments, setPayments] = useState<{ id: string; amount: number; plan: string; status: string; createdAt: string }[]>([]);
  useEffect(() => {
    fetch("/api/user/payments", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPayments((d.payments || []).filter((p: { plan: string }) => p.plan.startsWith("CREDITS_"))))
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      {/* Title says "purchases", not the broader "transactions" it used to claim --
          this list only ever contained CREDITS_* payments, so a user looking here
          for where their credits went found nothing and assumed it was lost
          (QA 2026-09-15, U06). Consumption lives in CreditUsageHistory below. */}
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <History className="w-4 h-4" /> {tri(lang, "خریدهای کردیت", "Credit purchases", "Guthabenkäufe")}
      </h2>
      {payments.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "هنوز تراکنشی ثبت نشده است.", "No transactions yet.", "Noch keine Transaktionen.")}
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
              <div>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{TX_TYPE_LABEL.purchase[lang]}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{lang === "fa" ? toJalali(p.createdAt) : new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-medium" style={{ color: p.status === "SUCCESS" ? "#22c55e" : p.status === "FAILED" ? "#ef4444" : "#f59e0b" }}>
                {formatNumber(p.amount, lang)} {tri(lang, "تومان", "Toman", "Toman")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Human-readable names for UsageLog.type, which stores raw tool keys. */
const USAGE_TYPE_LABEL: Record<string, Record<string, string>> = {
  chat: { fa: "چت", en: "Chat", de: "Chat" },
  image: { fa: "تولید تصویر", en: "Image generation", de: "Bildgenerierung" },
  video: { fa: "تولید ویدیو", en: "Video generation", de: "Videogenerierung" },
  music: { fa: "تولید موزیک", en: "Music generation", de: "Musikgenerierung" },
  seo: { fa: "سئو", en: "SEO", de: "SEO" },
  social: { fa: "شبکه‌های اجتماعی", en: "Social", de: "Social Media" },
};

interface UsageEntry {
  id: string;
  type: string;
  model: string | null;
  credits: number;
  createdAt: string;
}

/**
 * Where the credits actually went. Reads UsageLog through
 * /api/user/usage/history -- see that route's comment for why this exists.
 */
function CreditUsageHistory({ lang }: { lang: "fa" | "en" | "de" }) {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/usage/history", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="rounded-2xl p-5 mt-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <History className="w-4 h-4" /> {tri(lang, "مصرف کردیت", "Credit usage", "Guthabenverbrauch")}
      </h2>
      {!loaded ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} /></div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "هنوز کردیتی مصرف نشده است.", "No credits used yet.", "Noch kein Guthaben verbraucht.")}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {USAGE_TYPE_LABEL[e.type]?.[lang] || e.type}
                  {e.model && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}> · {e.model}</span>}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {lang === "fa" ? toJalali(e.createdAt) : new Date(e.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                −{formatNumber(e.credits, lang)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
