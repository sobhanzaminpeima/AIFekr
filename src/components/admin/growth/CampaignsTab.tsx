"use client";
import LiveCampaignCard from "./LiveCampaignCard";
import { CampaignReportCard } from "./ReportDownloads";
import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Missing, fmtDate, fmtNum, growthPost, useGrowth, useT } from "./shared";

type Campaign = { id: string; name: string; status: string; targetModule: string | null; landingPath: string; utmSource: string; utmMedium: string; spendToman: number | null; startsAt: string | null; endsAt: string | null; recommendedPlan: string | null; notes: string };
type Row = { key: string; campaign: Campaign | null; visits: number | null; visitors: number | null; signups: number; firstValue: number; repeat: number; pricingViews: number; checkouts: number; paid: number; revenueToman: number; creditsUsed: number; activationRate: number | null; conversionRate: number | null; cacToman: number | null };
type Data = { campaigns: Row[]; modules: { id: string; name: [string, string]; landingPath: string }[]; origin: string };
type Form = { id?: string; name: string; utmCampaign: string; utmSource: string; utmMedium: string; targetModule: string; landingPath: string; status: string; startsAt: string; endsAt: string; spendToman: string; recommendedPlan: string; notes: string };
const hint = (text: string) => <small className="gc-sub" style={{ display: "block", fontWeight: 400, lineHeight: 1.7 }}>{text}</small>;
/** The AIFekr Live Instagram launch, ready to save (see followup/liveCampaign.ts). */
const LIVE_PRESET: Form = { name: "AIFekr لایو — اینستاگرام", utmCampaign: "instagram_aifekr_live_launch", utmSource: "instagram", utmMedium: "comment_dm", targetModule: "live", landingPath: "/live", status: "draft", startsAt: "", endsAt: "", spendToman: "", recommendedPlan: "", notes: "کامنت «لایو» زیر پست ← دایرکت با لینک ← /live" };
const empty: Form = { name: "", utmCampaign: "", utmSource: "instagram", utmMedium: "paid_social", targetModule: "", landingPath: "/", status: "draft", startsAt: "", endsAt: "", spendToman: "", recommendedPlan: "", notes: "" };

export default function CampaignsTab() {
  const { t, lang, fa } = useT();
  const { data, error, loading, reload } = useGrowth<Data>("view=campaigns");
  const [form, setForm] = useState<Form | null>(null), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState(""), [copied, setCopied] = useState(false);
  const url = form && data ? `${data.origin}${form.landingPath}?${new URLSearchParams({ utm_source: form.utmSource, utm_medium: form.utmMedium, utm_campaign: form.utmCampaign })}` : "";
  const edit = (r: Row) => setForm(r.campaign ? { id: r.campaign.id, name: r.campaign.name, utmCampaign: r.key, utmSource: r.campaign.utmSource, utmMedium: r.campaign.utmMedium, targetModule: r.campaign.targetModule ?? "", landingPath: r.campaign.landingPath, status: r.campaign.status, startsAt: r.campaign.startsAt?.slice(0, 10) ?? "", endsAt: r.campaign.endsAt?.slice(0, 10) ?? "", spendToman: r.campaign.spendToman?.toString() ?? "", recommendedPlan: r.campaign.recommendedPlan ?? "", notes: r.campaign.notes } : { ...empty, name: r.key, utmCampaign: r.key });
  async function save() {
    if (!form) return;
    setBusy(true); setSaveError("");
    try {
      await growthPost({ action: "saveCampaign", campaign: { ...form, targetModule: form.targetModule || null, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null, spendToman: form.spendToman ? Number(form.spendToman) : null, recommendedPlan: form.recommendedPlan || null } });
      setForm(null); reload();
    } catch (e) { setSaveError(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); }
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => f && { ...f, [k]: e.target.value });
  const n = (v: number | null) => v == null ? <Missing/> : fmtNum(v, lang);
  const p = (v: number | null) => v == null ? <Missing/> : `${fmtNum(v, lang)}%`;
  return <div className="gc-grid">
    <LiveCampaignCard/>
    <CampaignReportCard campaigns={(data?.campaigns ?? []).map(r => ({ key: r.key, name: r.campaign?.name ?? null }))}/>
    <div className="gc-toolbar"><button className="gc-btn gc-primary" onClick={() => setForm({ ...empty })}><Plus size={16}/>{t("کمپین جدید", "New campaign")}</button><button className="gc-btn" onClick={() => setForm({ ...LIVE_PRESET })}>{t("پر کردن خودکار: کمپین AIFekr لایو", "Prefill: AIFekr Live campaign")}</button><span className="gc-sub">{t("انتساب = اولین تماس کاربر. درآمد = همهٔ پرداخت‌های موفق کاربران منتسب. CAC فقط وقتی هزینهٔ تبلیغ وارد شده باشد.", "Attribution = the user's first touch. Revenue = all successful payments of attributed users. CAC only when ad spend is entered.")}</span></div>
    {form && data && <section className="gc-card" aria-label={t("ویرایش کمپین", "Edit campaign")}>
      <h2>{form.id ? t("ویرایش کمپین", "Edit campaign") : t("کمپین جدید", "New campaign")}</h2>
      <p className="gc-sub">{t("این فرم فقط یک «برچسب» برای شمارش است: لینکی می‌سازد که در تبلیغ یا دایرکت می‌گذارید، و هر کس با آن لینک بیاید به این کمپین نسبت داده می‌شود. چیزی منتشر یا ارسال نمی‌کند. فیلدهای انگلیسی فقط حروف کوچک انگلیسی، عدد، خط تیره و زیرخط می‌گیرند.", "This form only creates a tracking label: it builds the link you put in an ad or DM, and anyone who arrives through it is credited to this campaign. It posts or sends nothing. The English fields accept only lowercase letters, digits, - and _.")}</p>
      <div className="gc-form" style={{ marginTop: 10 }}>
        <label>{t("نام", "Name")}<input value={form.name} onChange={set("name")}/>{hint(t("نامی که خودتان در گزارش می‌بینید. مثال: لایو اینستاگرام آبان", "Your own name for reports, e.g. Instagram Live November"))}</label>
        <label>{t("شناسهٔ کمپین (utm_campaign)", "Campaign id (utm_campaign)")}<input dir="ltr" value={form.utmCampaign} onChange={set("utmCampaign")} placeholder="instagram_aifekr_live_launch"/>{hint(t("یک اسم انگلیسی یکتا و ثابت برای این کمپین؛ بعداً عوضش نکنید. مثال: instagram_aifekr_live_launch", "A unique, fixed English id; don't change it later. e.g. instagram_aifekr_live_launch"))}</label>
        <label>{t("منبع (utm_source)", "Source (utm_source)")}<input dir="ltr" value={form.utmSource} onChange={set("utmSource")}/>{hint(t("بازدیدکننده از کجا می‌آید: instagram، telegram، google، youtube", "Where visitors come from: instagram, telegram, google, youtube"))}</label>
        <label>{t("نوع تبلیغ (utm_medium)", "Medium (utm_medium)")}<input dir="ltr" value={form.utmMedium} onChange={set("utmMedium")}/>{hint(t("چه نوع تبلیغی: comment_dm (دایرکت بعد از کامنت)، paid_social (تبلیغ پولی)، story، bio، influencer", "What kind: comment_dm, paid_social, story, bio, influencer"))}</label>
        <label>{t("ماژول هدف", "Target module")}<select value={form.targetModule} onChange={e => { const m = data.modules.find(x => x.id === e.target.value); setForm(f => f && { ...f, targetModule: e.target.value, landingPath: m ? m.landingPath : f.landingPath }); }}><option value="">{t("کل پلتفرم", "Whole platform")}</option>{data.modules.map(m => <option key={m.id} value={m.id}>{m.name[fa ? 0 : 1]}</option>)}</select></label>
        <label>{t("صفحهٔ فرود", "Landing page")}<input dir="ltr" value={form.landingPath} onChange={set("landingPath")}/>{hint(t("صفحه‌ای که لینک باز می‌کند؛ با انتخاب ماژول خودکار پر می‌شود. مثال: /live یا /features/voice-studio", "The page the link opens; filled when you pick a module. e.g. /live"))}</label>
        <label>{t("وضعیت", "Status")}<select value={form.status} onChange={set("status")}>{["draft", "active", "paused", "ended"].map(s => <option key={s} value={s}>{({ draft: t("پیش‌نویس", "Draft"), active: t("فعال", "Active"), paused: t("متوقف", "Paused"), ended: t("تمام‌شده", "Ended") } as Record<string, string>)[s]}</option>)}</select>{hint(t("فقط برای مرتب‌کردن گزارش است؛ شمارش در هر وضعیتی انجام می‌شود.", "For your reports only; visits are counted in any status."))}</label>
        <label>{t("شروع", "Start")}<input type="date" value={form.startsAt} onChange={set("startsAt")}/></label>
        <label>{t("پایان", "End")}<input type="date" value={form.endsAt} onChange={set("endsAt")}/>{hint(t("شروع و پایان اختیاری‌اند.", "Start and end are optional."))}</label>
        <label>{t("هزینهٔ تبلیغ (تومان، اختیاری)", "Ad spend (Toman, optional)")}<input inputMode="numeric" value={form.spendToman} onChange={set("spendToman")}/>{hint(t("اگر برای تبلیغ پول داده‌اید، مبلغ کل؛ تا خالی باشد هزینهٔ جذب هر مشتری حساب نمی‌شود.", "Total paid for ads; leave empty and no cost per customer is shown."))}</label>
        <label>{t("کد پلن پیشنهادی (اختیاری)", "Recommended plan code (optional)")}<input dir="ltr" value={form.recommendedPlan} onChange={set("recommendedPlan")}/>{hint(t("معمولاً خالی بگذارید. فقط اگر می‌خواهید پلن خاصی پیشنهاد شود، کد آن از بخش پکیج‌ها.", "Usually empty; a package plan code if you want one suggested."))}</label>
      </div>
      <label style={{ marginTop: 10 }}>{t("یادداشت", "Notes")}<textarea value={form.notes} onChange={set("notes")}/>{hint(t("اختیاری، فقط برای خودتان.", "Optional, for yourself."))}</label>
      {form.utmCampaign && <p className="gc-sub">{t("این لینک را کپی کنید و در دایرکت، بیو یا تبلیغ بگذارید:", "Copy this link into your DM, bio or ad:")}</p>}
      {form.utmCampaign && <div className="gc-url"><code>{url}</code><button className="gc-btn" onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}><Copy size={14}/>{copied ? t("کپی شد", "Copied") : t("کپی لینک", "Copy link")}</button></div>}
      {saveError && <p className="gc-error" role="alert">{saveError}</p>}
      <div className="gc-toolbar" style={{ marginTop: 10 }}><button className="gc-btn gc-primary" disabled={busy || !form.name || !form.utmCampaign} onClick={() => void save()}>{t("ذخیره", "Save")}</button><button className="gc-btn" onClick={() => setForm(null)}>{t("انصراف", "Cancel")}</button></div>
    </section>}
    {error && <p className="gc-error" role="alert">{error}</p>}
    {loading && !data ? <div className="gc-skeleton"/> : data && (data.campaigns.length ? <div className="gc-table-wrap"><table>
      <thead><tr><th>{t("کمپین / منبع", "Campaign / source")}</th><th>{t("وضعیت", "Status")}</th><th className="gc-num">{t("بازدید", "Visits")}</th><th className="gc-num">{t("بازدیدکننده", "Visitors")}</th><th className="gc-num">{t("ثبت‌نام", "Signups")}</th><th className="gc-num">{t("نتیجهٔ اول", "First value")}</th><th className="gc-num">{t("فعال‌سازی", "Activation")}</th><th className="gc-num">{t("تکرار", "Repeat")}</th><th className="gc-num">{t("دیدن قیمت", "Pricing")}</th><th className="gc-num">{t("پرداخت", "Checkout")}</th><th className="gc-num">{t("خرید", "Paid")}</th><th className="gc-num">{t("تبدیل", "Conv.")}</th><th className="gc-num">{t("درآمد (تومان)", "Revenue (T)")}</th><th className="gc-num">{t("کردیت مصرفی", "Credits used")}</th><th className="gc-num">CAC</th></tr></thead>
      <tbody>{data.campaigns.map(r => <tr key={r.key}>
        <td><button className="gc-btn" style={{ minHeight: 32 }} onClick={() => edit(r)} title={t("ویرایش / ساخت لینک", "Edit / build link")}>{r.campaign?.name ?? (r.key === "unknown" ? t("نامشخص (بدون شاهد)", "Unknown (no evidence)") : r.key)}</button><div className="gc-sub" dir="ltr">{r.key}{r.campaign?.startsAt ? ` · ${fmtDate(r.campaign.startsAt, lang)}` : ""}</div></td>
        <td>{r.campaign ? <span className="gc-pill">{r.campaign.status}</span> : <span className="gc-sub">{t("ثبت‌نشده", "Unregistered")}</span>}</td>
        <td className="gc-num">{n(r.visits)}</td><td className="gc-num">{n(r.visitors)}</td><td className="gc-num">{fmtNum(r.signups, lang)}</td><td className="gc-num">{fmtNum(r.firstValue, lang)}</td><td className="gc-num">{p(r.activationRate)}</td><td className="gc-num">{fmtNum(r.repeat, lang)}</td><td className="gc-num">{fmtNum(r.pricingViews, lang)}</td><td className="gc-num">{fmtNum(r.checkouts, lang)}</td><td className="gc-num">{fmtNum(r.paid, lang)}</td><td className="gc-num">{p(r.conversionRate)}</td><td className="gc-num">{fmtNum(r.revenueToman, lang)}</td><td className="gc-num">{fmtNum(r.creditsUsed, lang)}</td><td className="gc-num">{r.cacToman != null ? fmtNum(r.cacToman, lang) : <Missing>{r.campaign?.spendToman == null ? t("هزینه وارد نشده", "No spend") : t("خریدار ندارد", "No buyers")}</Missing>}</td>
      </tr>)}</tbody></table></div> : <p className="gc-card gc-empty">{t("هنوز کمپین یا ورودی ردیابی‌شده‌ای نیست. یک کمپین بسازید و لینک آن را در تبلیغ استفاده کنید.", "No campaigns or tracked landings yet. Create a campaign and use its link in your ad.")}</p>)}
  </div>;
}
