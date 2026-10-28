"use client";
import { useState } from "react";
import type { GrowthSettings } from "@/lib/growth/config";
import { growthPost, useGrowth, useT } from "./shared";

const FLAG_LABELS: Record<keyof GrowthSettings["flags"], [string, string, string, string]> = {
  customer_growth_enabled: ["مرکز رشد مشتری", "Customer Growth Center", "داشبورد و API مدیریت", "Admin dashboard and API"],
  customer_event_tracking_enabled: ["ثبت رویدادها و منبع ورود", "Event & attribution tracking", "UTM، ارجاع، بازدید قیمت و رویدادهای ماژول", "UTM, referrers, pricing views and module events"],
  smart_onboarding_enabled: ["آشنایی هوشمند", "Smart onboarding", "پرسش‌های کوتاه و بازگشت مستقیم به ماژول کمپین", "Short questions and direct return to the campaign module"],
  lead_scoring_enabled: ["امتیازدهی مشتری", "Lead scoring", "امتیاز قابل توضیح در جدول مشتریان", "Explainable score in the customer table"],
  personalized_upgrade_enabled: ["پیشنهاد پلن در ماژول", "In-module plan suggestion", "فقط از جدول پکیج‌های واقعی", "Only from the real package table"],
  lifecycle_automation_enabled: ["اتوماسیون چرخهٔ عمر", "Lifecycle automation", "اجرای زمان‌بندی‌شدهٔ قواعد (فقط مدیر ارشد)", "Scheduled rule runs (super admin only)"],
  automated_communications_enabled: ["ارسال خودکار پیام", "Automated communications", "بدون این سوییچ هیچ پیامی ارسال نمی‌شود (فقط مدیر ارشد)", "Without this nothing is sent (super admin only)"],
  ai_customer_insights_enabled: ["خلاصهٔ هوش مصنوعی", "AI insights", "هنوز پیاده نشده؛ خلاصه‌ها قاعده‌محورند", "Not implemented yet; summaries are rule-based"],
  adaptive_workspaces_enabled: ["فضاهای کاری تطبیقی", "Adaptive workspaces", "انتخاب فضای کار، منو و خانهٔ شخصی؛ خاموش = منوی کلاسیک", "Workspace switcher, personal sidebar and home; off = classic menu"],
};
const TH: Record<keyof GrowthSettings["thresholds"], [string, string]> = {
  newUserDays: ["روزهای «کاربر جدید»", "New-user days"], inactiveDays: ["روزهای عدم‌فعالیت", "Inactive after (days)"], lowCredits: ["آستانهٔ کردیت کم", "Low-credit threshold"],
  engagedActiveDays: ["روز فعال برای «درگیر»", "Active days for 'engaged'"], highIntentScore: ["امتیاز «قصد خرید بالا»", "High-intent score"], atRiskPaidInactiveDays: ["عدم‌فعالیت پولیِ در خطر (روز)", "At-risk paid inactivity (days)"],
  renewalSoonDays: ["روزهای «تمدید نزدیک»", "Renewal-soon days"], nurtureBand: ["شروع باند پرورش", "Nurture band starts at"], salesBand: ["شروع باند فروش", "Sales band starts at"], scoringWindowDays: ["پنجرهٔ امتیازدهی (روز)", "Scoring window (days)"],
};
const W: Record<keyof GrowthSettings["weights"], [string, string]> = {
  onboardingCompleted: ["تکمیل آشنایی", "Onboarding completed"], firstValue: ["نتیجهٔ اول", "First result"], returnedAnotherDay: ["بازگشت در روز دیگر", "Returned another day"],
  repeatedModuleUse: ["۳+ نتیجه در یک ماژول", "3+ results in one module"], pricingViewed: ["دیدن قیمت/پلن", "Viewed pricing/plans"], checkoutStarted: ["شروع پرداخت", "Checkout started"], demoRequested: ["درخواست کمک/دمو", "Requested help/demo"],
};

export default function SettingsTab() {
  const { t, fa } = useT();
  const { data, error, loading, reload } = useGrowth<{ settings: GrowthSettings }>("view=settings");
  const [draft, setDraft] = useState<GrowthSettings | null>(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const s = draft ?? data?.settings;
  if (error) return <p className="gc-error" role="alert">{error}</p>;
  if (loading && !s) return <div className="gc-skeleton"/>;
  if (!s) return null;
  const upd = (fn: (x: GrowthSettings) => GrowthSettings) => setDraft(fn(structuredClone(s)));
  async function save() {
    if (!draft) return;
    setBusy(true); setErr(""); setMsg("");
    try { await growthPost({ action: "saveSettings", settings: draft }); setDraft(null); setMsg(t("ذخیره شد و در گزارش ممیزی ثبت شد.", "Saved and recorded in the audit log.")); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); }
  }
  return <div className="gc-grid">
    <section className="gc-card"><h2>{t("سوییچ‌ها", "Feature flags")}</h2><div className="gc-grid" style={{ marginTop: 10 }}>{(Object.keys(FLAG_LABELS) as (keyof GrowthSettings["flags"])[]).map(k => <label key={k} className="gc-switch"><input type="checkbox" checked={s.flags[k]} onChange={e => upd(x => (x.flags[k] = e.target.checked, x))}/><span><b>{FLAG_LABELS[k][fa ? 0 : 1]}</b> <span className="gc-sub">— {FLAG_LABELS[k][fa ? 2 : 3]}</span></span></label>)}</div></section>
    <div className="gc-grid gc-two">
      <section className="gc-card"><h2>{t("آستانه‌ها", "Thresholds")}</h2><div className="gc-form" style={{ marginTop: 10 }}>{(Object.keys(TH) as (keyof GrowthSettings["thresholds"])[]).map(k => <label key={k}>{TH[k][fa ? 0 : 1]}<input type="number" min={0} value={s.thresholds[k]} onChange={e => upd(x => (x.thresholds[k] = Number(e.target.value), x))}/></label>)}</div></section>
      <section className="gc-card"><h2>{t("وزن‌های امتیاز (فرضیه، نه مدل اعتبارسنجی‌شده)", "Score weights (hypotheses, not a validated model)")}</h2><div className="gc-form" style={{ marginTop: 10 }}>{(Object.keys(W) as (keyof GrowthSettings["weights"])[]).map(k => <label key={k}>{W[k][fa ? 0 : 1]}<input type="number" min={0} max={100} value={s.weights[k]} onChange={e => upd(x => (x.weights[k] = Number(e.target.value), x))}/></label>)}</div></section>
    </div>
    <section className="gc-card"><h2>{t("محدودیت پیام", "Messaging limits")}</h2><div className="gc-form" style={{ marginTop: 10 }}>
      <label>{t("حداقل فاصلهٔ دو پیام (ساعت)", "Min hours between messages")}<input type="number" value={s.messaging.minHoursBetween} onChange={e => upd(x => (x.messaging.minHoursBetween = Number(e.target.value), x))}/></label>
      <label>{t("حداکثر پیام در ۱۴ روز", "Max messages per 14 days")}<input type="number" value={s.messaging.maxPer14Days} onChange={e => upd(x => (x.messaging.maxPer14Days = Number(e.target.value), x))}/></label>
      <label>{t("شروع ساعت سکوت (تهران)", "Quiet hours start (Tehran)")}<input type="number" min={0} max={23} value={s.messaging.quietStartHour} onChange={e => upd(x => (x.messaging.quietStartHour = Number(e.target.value), x))}/></label>
      <label>{t("پایان ساعت سکوت", "Quiet hours end")}<input type="number" min={0} max={23} value={s.messaging.quietEndHour} onChange={e => upd(x => (x.messaging.quietEndHour = Number(e.target.value), x))}/></label>
    </div></section>
    {err && <p className="gc-error" role="alert">{err}</p>}{msg && <p className="gc-sub" role="status">{msg}</p>}
    <div className="gc-toolbar"><button className="gc-btn gc-primary" disabled={!draft || busy} onClick={() => void save()}>{t("ذخیرهٔ تنظیمات", "Save settings")}</button>{draft && <button className="gc-btn" onClick={() => setDraft(null)}>{t("لغو تغییرات", "Discard changes")}</button>}</div>
  </div>;
}
