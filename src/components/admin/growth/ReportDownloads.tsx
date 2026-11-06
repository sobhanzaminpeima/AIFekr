"use client";
import { useState } from "react";
import { Download, MessageSquareText } from "lucide-react";
import { useT } from "./shared";

/** Fetches a file from the growth API and saves it; API errors are shown instead of being saved as a file. */
async function download(query: string): Promise<string | null> {
  const r = await fetch(`/api/admin/growth?${query}`, { cache: "no-store" });
  if (!r.ok) { const d = await r.json().catch(() => ({})); return d.error || `HTTP_${r.status}`; }
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "aifekr-report";
  const url = URL.createObjectURL(await r.blob()), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Campaigns tab: the complete campaign report, per campaign or all, as CSV or an AI analysis pack (JSON/Markdown). */
export function CampaignReportCard({ campaigns }: { campaigns: { key: string; name: string | null }[] }) {
  const { t } = useT();
  const [to, setTo] = useState(() => iso(new Date())), [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const [campaign, setCampaign] = useState(""), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const go = async (format: string) => {
    setBusy(format); setErr("");
    const q = new URLSearchParams({ view: "campaign-pack", format, from, to, ...(campaign ? { campaign } : {}) }).toString();
    const e = await download(q).catch(() => "FAILED");
    if (e) setErr(e === "INVALID_RANGE" ? t("بازهٔ تاریخ نامعتبر است (حداکثر یک سال).", "Invalid date range (one year at most).") : e);
    setBusy("");
  };
  return <section className="gc-card">
    <h2>{t("گزارش کامل کمپین‌ها (برای تحلیل با هوش مصنوعی)", "Complete campaign report (for AI analysis)")}</h2>
    <p className="gc-sub">{t("قیف کامل (بازدید → ثبت‌نام → اولین نتیجه → خرید) با نرخ‌ها، منبع و UTM، استفاده از ماژول‌ها، زمان تا اولین نتیجه و تا خرید، خرید و درآمد از پرداخت‌های واقعی، کردیت از دفتر کردیت، ارسال‌های پیگیری با دلیل توقف، و آمار روزانه و هفتگی. فقط آمار تجمیعی است؛ هیچ نام، ایمیل، موبایل یا متن گفتگویی در فایل نیست، پس می‌توانید آن را به یک هوش مصنوعی بدهید. فایل Markdown تعریف همهٔ شاخص‌ها و مخرج‌ها را هم دارد.", "Full funnel (visit → sign-up → first result → purchase) with rates, source/UTM, module usage, time to first value and to purchase, purchases and revenue from real payments, credits from the ledger, follow-ups with suppression reasons, and daily/weekly series. Aggregates only: no names, emails, phones or conversation text, so it is safe to give to an AI. The Markdown file also defines every metric and denominator.")}</p>
    <div className="gc-toolbar">
      <label>{t("از", "From")}<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label>
      <label>{t("تا", "To")}<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label>
      <label>{t("کمپین", "Campaign")}<select value={campaign} onChange={e => setCampaign(e.target.value)}><option value="">{t("همهٔ کمپین‌ها", "All campaigns")}</option>{campaigns.map(c => <option key={c.key} value={c.key}>{c.name ? `${c.name} (${c.key})` : c.key}</option>)}</select></label>
    </div>
    <div className="gc-toolbar">
      <button className="gc-btn gc-primary" disabled={!!busy} onClick={() => void go("md")}><Download size={14}/>{t("بستهٔ تحلیل AI (Markdown)", "AI analysis pack (Markdown)")}</button>
      <button className="gc-btn" disabled={!!busy} onClick={() => void go("json")}><Download size={14}/>JSON</button>
      <button className="gc-btn" disabled={!!busy} onClick={() => void go("csv")}><Download size={14}/>{t("CSV خلاصه", "Summary CSV")}</button>
      <button className="gc-btn" disabled={!!busy} onClick={() => void go("csv-daily")}><Download size={14}/>{t("CSV روزانه", "Daily CSV")}</button>
      {busy && <span className="gc-sub" role="status">{t("در حال ساخت…", "Building…")}</span>}
    </div>
    {err && <p className="gc-error" role="alert">{err}</p>}
  </section>;
}

/** Customers tab: super-admin CSV of customers with a mobile number, for an SMS campaign sent by the owner. */
export function SmsListCard() {
  const { t } = useT();
  const [audience, setAudience] = useState("not_opted_out"), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    const e = await download(new URLSearchParams({ view: "phone-export", audience }).toString()).catch(() => "FAILED");
    if (e) setErr(e === "RATE_LIMITED" ? t("سقف خروجی گرفتن پر شده است (۳ بار در ساعت). کمی بعد دوباره امتحان کنید.", "Export limit reached (3 per hour). Try again later.") : /403|FORBIDDEN/i.test(e) ? t("فقط سوپرادمین می‌تواند این فهرست را بگیرد.", "Only a super admin can download this list.") : e);
    setBusy(false);
  };
  return <section className="gc-card">
    <h2><MessageSquareText size={16} style={{ verticalAlign: "middle" }}/> {t("فهرست موبایل کاربران برای پیامک", "Customers' mobile numbers for SMS")}</h2>
    <p className="gc-sub">{t("فایل CSV با نام، موبایل (E.164)، زبان، تاریخ ثبت‌نام، مرحلهٔ مشتری، پلن، آخرین فعالیت و وضعیت رضایت/لغو. فقط سوپرادمین؛ هر بار خروجی گرفتن ثبت می‌شود و حداکثر ۳ بار در ساعت ممکن است. این فایل اطلاعات شخصی است؛ آن را جایی منتشر نکنید.", "CSV with name, mobile (E.164), language, sign-up date, lifecycle stage, plan, last activity and consent/opt-out. Super admin only; every export is audited, at most 3 per hour. It is personal data: do not share it.")}</p>
    <div className="gc-banner" role="note">{t("طبق مقررات پیامک تبلیغاتی در ایران، هر پیام تبلیغاتی باید راه لغو داشته باشد (مثلاً «لغو۱۱») و فقط برای کسانی ارسال شود که لغو نکرده‌اند. پیش‌فرض این فهرست همین افراد است. کسانی را که لغو می‌کنند در پنل سامانهٔ پیامک هم از فهرست خارج کنید.", "Iranian promotional-SMS rules: every promotional message must include an opt-out (e.g. «لغو۱۱») and go only to people who have not opted out. That is this list's default. Also remove people who opt out in your SMS provider's panel.")}</div>
    <div className="gc-toolbar">
      <label>{t("مخاطبان", "Audience")}<select value={audience} onChange={e => setAudience(e.target.value)}>
        <option value="not_opted_out">{t("فقط کسانی که لغو نکرده‌اند (پیش‌فرض)", "Only people who haven't opted out (default)")}</option>
        <option value="consented">{t("فقط کسانی که صریحاً رضایت داده‌اند", "Only people who explicitly consented")}</option>
        <option value="all">{t("همه (برای پیام غیرتبلیغاتی)", "Everyone (non-promotional messages only)")}</option>
      </select></label>
      <button className="gc-btn gc-primary" disabled={busy} onClick={() => void go()}><Download size={14}/>{busy ? t("در حال ساخت…", "Building…") : t("دانلود CSV", "Download CSV")}</button>
    </div>
    {err && <p className="gc-error" role="alert">{err}</p>}
  </section>;
}
