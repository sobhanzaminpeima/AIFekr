"use client";
import { useCallback, useEffect, useState } from "react";
import { tri, useTranslation } from "@/lib/i18n";

export function useT() {
  const { lang } = useTranslation();
  return { lang, fa: lang === "fa", t: (fa: string, en: string) => tri(lang, fa, en, en, en) };
}

/** GET /api/admin/growth with loading/error state; `reload` re-fetches. */
export function useGrowth<T>(query: string | null) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  useEffect(() => {
    if (query === null) return;
    let live = true;
    fetch(`/api/admin/growth?${query}`, { cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP_${r.status}`); return d; })
      .then(d => { if (live) { setData(d); setError(""); } }).catch(e => { if (live) setError(e instanceof Error ? e.message : "FAILED"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [query, tick]);
  const reload = useCallback(() => { setLoading(true); setTick(n => n + 1); }, []);
  return { data, error, loading, reload };
}

export async function growthPost(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error([d.error, ...(d.issues || [])].filter(Boolean).join(" · ") || `HTTP_${r.status}`);
  return d;
}

export const fmtDate = (v: string | Date | null | undefined, lang: string) => v ? new Date(v).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-GB", { year: "numeric", month: "short", day: "numeric" }) : "—";
export const fmtNum = (v: number | null | undefined, lang: string) => v == null ? null : v.toLocaleString(lang === "fa" ? "fa-IR" : "en-US");

export const STAGE_LABELS: Record<string, [string, string]> = {
  signed_up: ["ثبت‌نام", "Signed up"], onboarding: ["آشنایی", "Onboarding"], activated: ["فعال‌شده", "Activated"], engaged: ["درگیر", "Engaged"],
  purchase_intent: ["نزدیک خرید", "Purchase intent"], paid: ["مشتری پولی", "Paying"], renewed: ["تمدیدکرده", "Renewed"], at_risk: ["در خطر", "At risk"], churned: ["ریزش‌کرده", "Churned"],
};
export const SEGMENT_LABELS: Record<string, [string, string]> = {
  new: ["کاربران جدید", "New users"], unactivated: ["فعال‌نشده", "Unactivated"], activated_free: ["رایگانِ فعال‌شده", "Activated free"], engaged_free: ["رایگانِ درگیر", "Engaged free"],
  high_intent: ["قصد خرید بالا", "High intent"], low_credit: ["کردیت کم", "Low credit"], inactive: ["غیرفعال", "Inactive"], paying: ["مشتریان پولی", "Paying"],
  at_risk_paying: ["پولیِ در خطر", "At-risk paying"], renewed: ["تمدیدکرده", "Renewed"], cancelled: ["لغو/پایان‌یافته", "Cancelled/ended"],
};
export const BAND_LABELS: Record<string, [string, string]> = { activation: ["اولویت فعال‌سازی", "Activation priority"], nurture: ["اولویت پرورش", "Nurture priority"], sales: ["اولویت پیگیری فروش", "Sales follow-up"] };
export const ACTION_LABELS: Record<string, [string, string]> = {
  help_with_failed_payment: ["کمک به پرداخت ناموفق", "Help with the failed payment"], check_in_paid_customer: ["تماس و پرسیدن حال مشتری پولی", "Check in with the paying customer"],
  offer_plan_guidance: ["راهنمایی برای انتخاب پلن مناسب", "Offer guidance on choosing a plan"], explain_paid_benefits: ["توضیح مزایای پلن برای کاری که انجام می‌دهد", "Explain plan benefits for their use"],
  suggest_second_workflow: ["پیشنهاد یک کار مفید دوم", "Suggest a second useful workflow"], guide_to_first_result: ["کمک به گرفتن اولین نتیجه", "Help them reach a first result"],
  ask_for_feedback: ["درخواست بازخورد", "Ask for feedback"], none: ["—", "—"],
};

export function Missing({ children }: { children?: React.ReactNode }) {
  const { t } = useT();
  return <span className="gc-na" title={t("داده‌ای برای محاسبه وجود ندارد (صفر نیست).", "No data to calculate this (not zero).")}>{children ?? t("نامشخص", "N/A")}</span>;
}
