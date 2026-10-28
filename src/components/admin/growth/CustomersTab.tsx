"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { GROWTH_MODULES } from "@/lib/growth/modules";
import { BAND_LABELS, Missing, SEGMENT_LABELS, STAGE_LABELS, fmtDate, fmtNum, useGrowth, useT } from "./shared";

type Row = { id: string; name: string | null; email: string | null; phone: string | null; createdAt: string; plan: string; credits: number; source: string | null; confidence: string; stage: string; score: number; band: string; segments: string[]; lastActiveAt: string | null; preferredModule: string | null; followUpStatus: string };
type Data = { total: number; page: number; size: number; rows: Row[]; segmentCounts: Record<string, number>; settings: { thresholds: Record<string, number>; weights: Record<string, number> } };

export default function CustomersTab() {
  const { t, lang, fa } = useT();
  const [q, setQ] = useState(""), [query, setQuery] = useState(""), [stage, setStage] = useState(""), [segment, setSegment] = useState(""), [band, setBand] = useState(""), [page, setPage] = useState(1);
  const params = new URLSearchParams({ view: "customers", q: query, stage, segment, band, page: String(page) }).toString();
  const { data, error, loading } = useGrowth<Data>(params);
  const th = data?.settings.thresholds;
  const defs: Record<string, string> = th ? {
    new: t(`ثبت‌نام در ${th.newUserDays} روز اخیر`, `Registered in the last ${th.newUserDays} days`), unactivated: t("هنوز هیچ خروجی واقعی نگرفته", "No real output yet"),
    activated_free: t("حداقل یک خروجی واقعی، بدون پلن پولی فعال", "At least one real output, no active paid plan"), engaged_free: t(`رایگان با حداقل ${th.engagedActiveDays} روز فعال در ${th.scoringWindowDays} روز`, `Free with ≥${th.engagedActiveDays} active days in ${th.scoringWindowDays} days`),
    high_intent: t(`رایگان با امتیاز ≥ ${th.highIntentScore}`, `Free with score ≥ ${th.highIntentScore}`), low_credit: t(`کردیت ≤ ${th.lowCredits}`, `Credits ≤ ${th.lowCredits}`),
    inactive: t(`بدون فعالیت در ${th.inactiveDays} روز`, `No activity for ${th.inactiveDays} days`), paying: t("پلن فعال و حداقل یک پرداخت موفق", "Active plan and at least one successful payment"),
    at_risk_paying: t(`پولی با ${th.atRiskPaidInactiveDays} روز عدم فعالیت، پرداخت ناموفق اخیر، یا تمدید نزدیک با استفادهٔ کم`, `Paying with ${th.atRiskPaidInactiveDays} inactive days, a recent failed payment, or renewal soon with low usage`),
    renewed: t("پولی با ۲ پرداخت موفق یا بیشتر", "Paying with 2+ successful payments"), cancelled: t("قبلاً پرداخت کرده، اکنون پلن فعال ندارد", "Paid before, no active plan now"),
  } : {};
  const exportUrl = `/api/admin/growth?${new URLSearchParams({ view: "export", q: query, stage, segment, band })}`;
  return <div className="gc-grid">
    <div className="gc-chips" role="group" aria-label={t("بخش‌ها", "Segments")}><button aria-pressed={!segment} onClick={() => { setSegment(""); setPage(1); }}>{t("همه", "All")}</button>{Object.entries(SEGMENT_LABELS).map(([k, l]) => <button key={k} aria-pressed={segment === k} title={defs[k]} onClick={() => { setSegment(k); setPage(1); }}>{l[fa ? 0 : 1]} {data ? `(${fmtNum(data.segmentCounts[k] ?? 0, lang)})` : ""}</button>)}</div>
    <form className="gc-toolbar" onSubmit={e => { e.preventDefault(); setQuery(q); setPage(1); }}>
      <label>{t("جستجو", "Search")}<span style={{ display: "flex", gap: 6 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder={t("نام، ایمیل یا موبایل", "Name, email or phone")}/><button className="gc-btn" type="submit" aria-label={t("جستجو", "Search")}><Search size={16}/></button></span></label>
      <label>{t("مرحله", "Stage")}<select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}><option value="">{t("همه", "All")}</option>{Object.entries(STAGE_LABELS).map(([k, l]) => <option key={k} value={k}>{l[fa ? 0 : 1]}</option>)}</select></label>
      <label>{t("اولویت", "Priority")}<select value={band} onChange={e => { setBand(e.target.value); setPage(1); }}><option value="">{t("همه", "All")}</option>{Object.entries(BAND_LABELS).map(([k, l]) => <option key={k} value={k}>{l[fa ? 0 : 1]}</option>)}</select></label>
      <a className="gc-btn" href={exportUrl} title={t("فقط مدیر ارشد؛ ثبت در گزارش ممیزی", "Super admin only; recorded in the audit log")}><Download size={16}/>CSV</a>
    </form>
    {segment && defs[segment] && <p className="gc-sub">{t("تعریف", "Definition")}: {defs[segment]}</p>}
    {error && <p className="gc-error" role="alert">{error}</p>}
    {loading && !data ? <div className="gc-skeleton"/> : data && (data.rows.length ? <>
      <div className="gc-table-wrap"><table>
        <thead><tr><th>{t("کاربر", "User")}</th><th>{t("ثبت‌نام", "Signed up")}</th><th>{t("منبع", "Source")}</th><th>{t("مرحله", "Stage")}</th><th>{t("پلن", "Plan")}</th><th className="gc-num">{t("کردیت", "Credits")}</th><th>{t("آخرین فعالیت", "Last active")}</th><th>{t("ماژول اصلی", "Main module")}</th><th className="gc-num">{t("امتیاز", "Score")}</th><th>{t("پیگیری", "Follow-up")}</th></tr></thead>
        <tbody>{data.rows.map(r => <tr key={r.id}>
          <td><Link href={`/admin/customer-growth/${r.id}`}>{r.name || r.email || r.phone || r.id}</Link><div className="gc-sub" dir="ltr">{r.email || r.phone}</div></td>
          <td>{fmtDate(r.createdAt, lang)}</td>
          <td>{r.source ? <span dir="ltr">{r.source}</span> : <Missing>{t("نامشخص", "Unknown")}</Missing>}<div className="gc-sub">{r.confidence}</div></td>
          <td><span className={`gc-pill gc-stage-${r.stage}`}>{STAGE_LABELS[r.stage]?.[fa ? 0 : 1] ?? r.stage}</span></td>
          <td>{r.plan}</td><td className="gc-num">{fmtNum(r.credits, lang)}</td><td>{fmtDate(r.lastActiveAt, lang)}</td>
          <td>{GROWTH_MODULES.find(m => m.id === r.preferredModule)?.name[fa ? 0 : 1] ?? "—"}</td>
          <td className="gc-num"><span className={`gc-pill gc-band-${r.band}`} title={BAND_LABELS[r.band]?.[fa ? 0 : 1]}>{fmtNum(r.score, lang)}</span></td>
          <td>{r.followUpStatus === "none" ? "—" : r.followUpStatus}</td>
        </tr>)}</tbody></table></div>
      <div className="gc-toolbar"><button className="gc-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("قبلی", "Previous")}</button><span className="gc-sub">{fmtNum(page, lang)} / {fmtNum(Math.max(1, Math.ceil(data.total / data.size)), lang)} · {fmtNum(data.total, lang)} {t("مشتری", "customers")}</span><button className="gc-btn" disabled={page * data.size >= data.total} onClick={() => setPage(page + 1)}>{t("بعدی", "Next")}</button></div>
    </> : <p className="gc-card gc-empty">{t("مشتری‌ای با این فیلتر نیست.", "No customers match this filter.")}</p>)}
    <p className="gc-sub">{t("امتیاز یک ابزار اولویت‌بندی بر پایهٔ قواعد قابل تنظیم است، نه احتمال خرید.", "The score is a prioritisation aid based on configurable rules, not a purchase probability.")}</p>
  </div>;
}
