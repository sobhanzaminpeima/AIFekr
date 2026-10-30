"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import { GROWTH_MODULES } from "@/lib/growth/modules";
import { Missing, STAGE_LABELS, fmtNum, useGrowth, useT } from "./shared";

type Overview = {
  kpis: Record<string, number | null>;
  funnel: { step: string; count: number; note?: string }[];
  stages: Record<string, number>;
  modules: [string, number][];
  generation: { modules: [string, { started: number; succeeded: number; failed: number; reasons: Record<string, number> }][]; firstSuccess: { count: number; medianMinutes: number | null } };
};

const REASONS: Record<string, [string, string]> = {
  credits: ["اعتبار کافی نبود", "Not enough credits"], plan: ["نیاز به پلن", "Plan required"], limit: ["سقف پلن", "Plan limit reached"],
  rate_limited: ["محدودیت سرعت", "Rate limited"], disabled: ["غیرفعال", "Disabled"], invalid_input: ["ورودی نامعتبر", "Invalid input"],
  forbidden: ["بدون دسترسی", "Not allowed"], provider: ["خطای سرویس", "Provider error"], cancelled: ["لغو یا قطع", "Cancelled"], unknown: ["نامشخص", "Unknown"],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function OverviewTab() {
  const { t, lang, fa } = useT();
  const [to, setTo] = useState(() => iso(new Date())), [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const { data, error, loading } = useGrowth<Overview>(`view=overview&from=${from}&to=${to}`);
  const k = data?.kpis;
  const pct = (v: number | null | undefined) => v == null ? <Missing/> : `${fmtNum(v, lang)}%`;
  const num = (v: number | null | undefined) => v == null ? <Missing/> : fmtNum(v, lang);
  const tiles: [string, React.ReactNode, string][] = k ? [
    [t("ثبت‌نام‌ها", "Signups"), num(k.signups), t("حساب‌های کاربری ساخته‌شده در بازه (بدون مدیران)", "Accounts created in the range (excluding admins)")],
    [t("فعال‌شده (نتیجهٔ اول)", "Activated (first value)"), num(k.firstValue), t("کاربرانی از این گروه که حداقل یک خروجی واقعی گرفته‌اند", "Users in this cohort with at least one real output")],
    [t("نرخ فعال‌سازی", "Activation rate"), pct(k.activationRate), t("فعال‌شده ÷ ثبت‌نام‌های بازه", "Activated ÷ signups in range")],
    [t("تکمیل آشنایی", "Onboarding completion"), pct(k.onboardingRate), t("تکمیل‌شده یا ورود مستقیم به ماژول ÷ ثبت‌نام‌ها", "Completed or contextual ÷ signups")],
    [t("شروع پرداخت", "Checkout starts"), num(k.checkoutStarts), t("کاربرانی که رکورد پرداخت ساخته‌اند (از جدول پرداخت)", "Users who created a payment record (Payment table)")],
    [t("خریدار", "Paid"), num(k.paid), t("کاربران این گروه با پرداخت تأییدشده توسط سرور", "Cohort users with a server-confirmed payment")],
    [t("تبدیل رایگان به پولی", "Free-to-paid"), pct(k.freeToPaid), t("خریدار ÷ ثبت‌نام‌ها؛ گروه‌های جوان هنوز کامل نیستند", "Paid ÷ signups; young cohorts are incomplete")],
    [t("تبدیل گروه بالغ", "Mature cohort conversion"), k.matureCohort ? pct(k.matureFreeToPaid) : <Missing>{t("گروه بالغ ندارد", "No mature cohort")}</Missing>, t("فقط کاربرانی که پنجرهٔ امتیازدهی‌شان کامل شده", "Only users whose scoring window has fully elapsed")],
    [t("درآمد این گروه (تومان)", "Cohort revenue (Toman)"), num(k.revenueToman), t("جمع پرداخت‌های موفق کاربران این گروه (معادل تومان در لحظهٔ پرداخت)", "Sum of successful payments by this cohort (Toman at checkout time)")],
    [t("مشتریان پولی فعلی", "Paying now"), num(k.payingNow), t("پلن فعال + حداقل یک پرداخت موفق", "Active plan + at least one successful payment")],
    [t("کاربران فعال", "Active now"), num(k.activeNow), t("فعالیت در بازهٔ عدم‌فعالیت تنظیم‌شده", "Activity within the configured inactivity window")],
    [t("مشترکان در خطر", "At-risk subscribers"), num(k.atRiskNow), t("قواعد تنظیم‌شده؛ پیش‌بینی آماری نیست", "Configured rules; not a statistical prediction")],
  ] : [];
  const top = data ? Math.max(1, ...data.funnel.map(f => f.count)) : 1;
  const stepLabel: Record<string, [string, string]> = { visitors: ["بازدیدکنندهٔ ردیابی‌شده", "Tracked visitors"], signups: ["ثبت‌نام", "Signup"], onboarding: ["آشنایی", "Onboarding"], first_value: ["نتیجهٔ اول", "First value"], repeat_usage: ["استفادهٔ تکراری", "Repeat usage"], checkout: ["شروع پرداخت", "Checkout"], paid: ["خرید", "Paid"] };
  return <div className="gc-grid">
    <div className="gc-toolbar"><label>{t("از", "From")}<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label><label>{t("تا", "To")}<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label><span className="gc-sub">{t("گروه ثبت‌نام: کاربرانی که در این بازه ثبت‌نام کرده‌اند. زمان‌ها UTC.", "Signup cohort: users who registered in this range. Times are UTC.")}</span></div>
    {error && <p className="gc-error" role="alert">{error}</p>}
    {loading && !data ? <div className="gc-grid gc-kpis">{Array.from({ length: 8 }, (_, i) => <div key={i} className="gc-skeleton"/>)}</div> : data && <>
      <div className="gc-grid gc-kpis">{tiles.map(([label, value, def]) => <div key={label} className="gc-card gc-kpi"><span className="gc-label" title={def}>{label}<Info size={12} aria-label={def}/></span><strong>{value}</strong><small>{def}</small></div>)}</div>
      <div className="gc-grid gc-two">
        <section className="gc-card"><h2>{t("قیف تبدیل", "Conversion funnel")}</h2><p className="gc-sub">{t("بازدیدکننده فقط از کمپین یا ارجاع خارجی شمرده می‌شود؛ بازدید مستقیم ردیابی نمی‌شود.", "Visitors only count campaign or external-referral landings; direct visits are not tracked.")}</p>
          <div className="gc-funnel">{data.funnel.map((f, i) => { const prev = i > 1 ? data.funnel[i - 1].count : null; return <div key={f.step} className="gc-funnel-row"><span>{stepLabel[f.step]?.[fa ? 0 : 1] ?? f.step}</span><div className="gc-bar" role="img" aria-label={`${f.count}`}><span style={{ width: `${Math.max(2, f.count * 100 / top)}%` }}/></div><b>{fmtNum(f.count, lang)}{prev ? <em>{Math.round(f.count * 100 / prev)}%</em> : null}</b></div>; })}</div>
        </section>
        <section className="gc-card"><h2>{t("مراحل چرخهٔ عمر (همهٔ مشتریان)", "Lifecycle stages (all customers)")}</h2>
          <div className="gc-funnel">{Object.entries(data.stages).sort((a, b) => b[1] - a[1]).map(([s, n]) => <div key={s} className="gc-funnel-row"><span className={`gc-stage-${s}`}>{STAGE_LABELS[s]?.[fa ? 0 : 1] ?? s}</span><div className="gc-bar"><span style={{ width: `${Math.max(2, n * 100 / Math.max(1, ...Object.values(data.stages)))}%` }}/></div><b>{fmtNum(n, lang)}</b></div>)}</div>
          <h3 style={{ marginTop: 16 }}>{t("ماژول‌هایی که این گروه در آن نتیجه گرفته", "Modules where this cohort got results")}</h3>
          {data.modules.length ? <div className="gc-funnel">{data.modules.map(([m, n]) => <div key={m} className="gc-funnel-row"><span>{GROWTH_MODULES.find(x => x.id === m)?.name[fa ? 0 : 1] ?? m}</span><div className="gc-bar"><span style={{ width: `${n * 100 / Math.max(1, data.funnel[1].count)}%` }}/></div><b>{fmtNum(n, lang)}</b></div>)}</div> : <p className="gc-empty">{t("هنوز نتیجه‌ای ثبت نشده.", "No results recorded yet.")}</p>}
        </section>
      </div>
      <section className="gc-card">
        <h2>{t("تلاش‌های تولید", "Generation attempts")}</h2>
        <p className="gc-sub">{t("از رویدادهای ثبت‌شده در سرور (از ۳۰ اکتبر ۲۰۲۶). شکست با دلیلش جدا از رها کردن کاربر دیده می‌شود.", "From server-recorded events (since 30 Oct 2026). A failure shows with its reason, apart from a user who left.")}</p>
        <p>{t("اولین موفقیت حساب‌های جدید", "New accounts' first success")}: <strong>{fmtNum(data.generation.firstSuccess.count, lang)}</strong>
          {data.generation.firstSuccess.medianMinutes != null && <> · {t("میانهٔ زمان از ثبت‌نام (دقیقه)", "median minutes from signup")}: <strong>{fmtNum(data.generation.firstSuccess.medianMinutes, lang)}</strong></>}</p>
        {data.generation.modules.length ? <div className="gc-table-wrap"><table className="gc-table">
          <thead><tr><th>{t("ابزار", "Tool")}</th><th>{t("شروع", "Started")}</th><th>{t("موفق", "Succeeded")}</th><th>{t("ناموفق", "Failed")}</th><th>{t("دلیل شکست", "Failure reasons")}</th></tr></thead>
          <tbody>{data.generation.modules.map(([m, r]) => <tr key={m}>
            <td>{GROWTH_MODULES.find(x => x.id === m)?.name[fa ? 0 : 1] ?? m}</td><td>{fmtNum(r.started, lang)}</td><td>{fmtNum(r.succeeded, lang)}</td><td>{fmtNum(r.failed, lang)}</td>
            <td>{Object.entries(r.reasons).map(([k, n]) => `${REASONS[k]?.[fa ? 0 : 1] ?? k}: ${fmtNum(n, lang)}`).join(" · ") || "—"}</td>
          </tr>)}</tbody>
        </table></div> : <Missing>{t("هنوز تلاشی در این بازه ثبت نشده", "No attempts recorded in this range yet")}</Missing>}
      </section>
      <details className="gc-card gc-defs"><summary>{t("تعریف دقیق شاخص‌ها", "Exact metric definitions")}</summary><dl>
        <dt>{t("نتیجهٔ اول", "First value")}</dt><dd>{t("اولین ردیف واقعی در جداول خروجی: تصویر/ویدئو/موسیقی بدون بازپرداخت، صدای آماده، پاسخ دستیار، مخاطب CRM، تحلیل سئو، پست، وبسایت، منبع درسی، پروفایل فیت. کلیک روی دکمه شمرده نمی‌شود.", "First real row in output tables: unrefunded image/video/music, READY voice audio, assistant reply, CRM contact, SEO audit, post, website, study material, fitness profile. Clicks never count.")}</dd>
        <dt>{t("خرید", "Paid")}</dt><dd>{t("Payment.status = SUCCESS که فقط توسط تأیید درگاه، وب‌هوک یا بررسی مدیر ثبت می‌شود.", "Payment.status = SUCCESS, set only by gateway verification, webhook or admin review.")}</dd>
        <dt>{t("استفادهٔ تکراری", "Repeat usage")}</dt><dd>{t("حداقل ۲ روز فعال در پنجرهٔ امتیازدهی یا حداقل ۲ خروجی موفق.", "At least 2 active days in the scoring window, or at least 2 successful outputs.")}</dd>
        <dt>{t("درآمد", "Revenue")}</dt><dd>{t("جمع مبلغ تومانی پرداخت‌های موفق؛ برای پرداخت ارزی، معادل تومان در زمان پرداخت.", "Sum of the Toman amount of successful payments; for foreign-currency payments, the Toman equivalent at checkout.")}</dd>
        <dt>{t("مستثنی", "Excluded")}</dt><dd>{t("مدیران و حساب‌های مسدود.", "Administrators and blocked accounts.")}</dd>
      </dl></details>
    </>}
  </div>;
}
