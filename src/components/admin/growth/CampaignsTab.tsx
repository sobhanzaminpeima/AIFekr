"use client";
import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Missing, fmtDate, fmtNum, growthPost, useGrowth, useT } from "./shared";

type Campaign = { id: string; name: string; status: string; targetModule: string | null; landingPath: string; utmSource: string; utmMedium: string; spendToman: number | null; startsAt: string | null; endsAt: string | null; recommendedPlan: string | null; notes: string };
type Row = { key: string; campaign: Campaign | null; visits: number | null; visitors: number | null; signups: number; firstValue: number; repeat: number; pricingViews: number; checkouts: number; paid: number; revenueToman: number; creditsUsed: number; activationRate: number | null; conversionRate: number | null; cacToman: number | null };
type Data = { campaigns: Row[]; modules: { id: string; name: [string, string]; landingPath: string }[]; origin: string };
type Form = { id?: string; name: string; utmCampaign: string; utmSource: string; utmMedium: string; targetModule: string; landingPath: string; status: string; startsAt: string; endsAt: string; spendToman: string; recommendedPlan: string; notes: string };
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
    <div className="gc-toolbar"><button className="gc-btn gc-primary" onClick={() => setForm({ ...empty })}><Plus size={16}/>{t("کمپین جدید", "New campaign")}</button><span className="gc-sub">{t("انتساب = اولین تماس کاربر. درآمد = همهٔ پرداخت‌های موفق کاربران منتسب. CAC فقط وقتی هزینهٔ تبلیغ وارد شده باشد.", "Attribution = the user's first touch. Revenue = all successful payments of attributed users. CAC only when ad spend is entered.")}</span></div>
    {form && data && <section className="gc-card" aria-label={t("ویرایش کمپین", "Edit campaign")}>
      <h2>{form.id ? t("ویرایش کمپین", "Edit campaign") : t("کمپین جدید", "New campaign")}</h2>
      <div className="gc-form" style={{ marginTop: 10 }}>
        <label>{t("نام", "Name")}<input value={form.name} onChange={set("name")}/></label>
        <label>utm_campaign<input dir="ltr" value={form.utmCampaign} onChange={set("utmCampaign")} placeholder="voice_studio_launch"/></label>
        <label>utm_source<input dir="ltr" value={form.utmSource} onChange={set("utmSource")}/></label>
        <label>utm_medium<input dir="ltr" value={form.utmMedium} onChange={set("utmMedium")}/></label>
        <label>{t("ماژول هدف", "Target module")}<select value={form.targetModule} onChange={e => { const m = data.modules.find(x => x.id === e.target.value); setForm(f => f && { ...f, targetModule: e.target.value, landingPath: m ? m.landingPath : f.landingPath }); }}><option value="">{t("کل پلتفرم", "Whole platform")}</option>{data.modules.map(m => <option key={m.id} value={m.id}>{m.name[fa ? 0 : 1]}</option>)}</select></label>
        <label>{t("صفحهٔ فرود", "Landing page")}<input dir="ltr" value={form.landingPath} onChange={set("landingPath")}/></label>
        <label>{t("وضعیت", "Status")}<select value={form.status} onChange={set("status")}>{["draft", "active", "paused", "ended"].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>{t("شروع", "Start")}<input type="date" value={form.startsAt} onChange={set("startsAt")}/></label>
        <label>{t("پایان", "End")}<input type="date" value={form.endsAt} onChange={set("endsAt")}/></label>
        <label>{t("هزینهٔ تبلیغ (تومان، اختیاری)", "Ad spend (Toman, optional)")}<input inputMode="numeric" value={form.spendToman} onChange={set("spendToman")}/></label>
        <label>{t("کد پلن پیشنهادی (اختیاری)", "Recommended plan code (optional)")}<input dir="ltr" value={form.recommendedPlan} onChange={set("recommendedPlan")}/></label>
      </div>
      <label style={{ marginTop: 10 }}>{t("یادداشت", "Notes")}<textarea value={form.notes} onChange={set("notes")}/></label>
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
