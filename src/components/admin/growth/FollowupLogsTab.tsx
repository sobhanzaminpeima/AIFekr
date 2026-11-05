"use client";
import { useState } from "react";
import Link from "next/link";
import { fmtDate, fmtNum, useFollowup, useT } from "./shared";
import { FOLLOWUP_REASON, FOLLOWUP_STATUS, label } from "./followupLabels";

type Row = { id: string; userId: string; userName: string | null; ruleKey: string; channel: string; mode: string; status: string; reason: string | null; variant: string; attempts: number; lastError: string | null; scheduledFor: string; nextAttemptAt: string; processedAt: string | null; sentAt: string | null; createdAt: string };
type Data = { total: number; page: number; size: number; rows: Row[] };

/** Every planned follow-up with its outcome. No message text or contact details are shown. */
export default function FollowupLogsTab() {
  const { t, fa, lang } = useT();
  const [status, setStatus] = useState(""), [mode, setMode] = useState(""), [rule, setRule] = useState(""), [page, setPage] = useState(1);
  const q = new URLSearchParams({ view: "jobs", status, mode, rule, page: String(page) }).toString();
  const { data, error, loading } = useFollowup<Data>(q);
  return <div className="gc-grid">
    <div className="gc-toolbar">
      <label>{t("وضعیت", "Status")}<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{t("همه", "All")}</option>{Object.keys(FOLLOWUP_STATUS).map(k => <option key={k} value={k}>{label(FOLLOWUP_STATUS, k, fa)}</option>)}</select></label>
      <label>{t("حالت", "Mode")}<select value={mode} onChange={e => { setMode(e.target.value); setPage(1); }}><option value="">{t("همه", "All")}</option><option value="dry_run">{t("آزمایشی", "Dry run")}</option><option value="live">{t("واقعی", "Live")}</option></select></label>
      <label>{t("قاعده", "Rule")}<input value={rule} dir="ltr" placeholder="welcome" onChange={e => { setRule(e.target.value.trim()); setPage(1); }}/></label>
    </div>
    {error && <p className="gc-error" role="alert">{error}</p>}
    {loading && !data ? <div className="gc-skeleton"/> : data && (data.rows.length ? <>
      <div className="gc-table-wrap"><table><thead><tr>
        <th>{t("زمان", "When")}</th><th>{t("کاربر", "User")}</th><th>{t("قاعده", "Rule")}</th><th>{t("کانال", "Channel")}</th><th>{t("حالت", "Mode")}</th><th>{t("وضعیت", "Status")}</th><th>{t("دلیل", "Reason")}</th><th>{t("تلاش", "Attempts")}</th>
      </tr></thead><tbody>{data.rows.map(r => <tr key={r.id}>
        <td>{fmtDate(r.processedAt ?? r.createdAt, lang)}</td>
        <td><Link href={`/admin/customer-growth/${r.userId}`}>{r.userName || r.userId.slice(0, 8)}</Link></td>
        <td dir="ltr">{r.ruleKey}{r.variant === "holdout" && <> <span className="gc-pill">{t("کنترل", "holdout")}</span></>}</td>
        <td>{r.channel}</td><td>{r.mode === "live" ? t("واقعی", "live") : t("آزمایشی", "dry run")}</td>
        <td>{label(FOLLOWUP_STATUS, r.status, fa)}</td>
        <td title={r.lastError ?? undefined}>{label(FOLLOWUP_REASON, r.reason, fa)}{r.status === "queued" && <span className="gc-sub"> · {fmtDate(r.nextAttemptAt, lang)}</span>}</td>
        <td>{fmtNum(r.attempts, lang)}</td>
      </tr>)}</tbody></table></div>
      <div className="gc-toolbar"><button className="gc-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("قبلی", "Previous")}</button><span className="gc-sub">{fmtNum(page, lang)} / {fmtNum(Math.max(1, Math.ceil(data.total / data.size)), lang)} · {fmtNum(data.total, lang)}</span><button className="gc-btn" disabled={page * data.size >= data.total} onClick={() => setPage(page + 1)}>{t("بعدی", "Next")}</button></div>
    </> : <p className="gc-empty">{t("هنوز هیچ پیگیری‌ای ثبت نشده است. وقتی موتور روشن شود (حتی در حالت آزمایشی)، کارها این‌جا دیده می‌شوند.", "No follow-ups recorded yet. Once the engine is on (even in dry-run mode), jobs appear here.")}</p>)}
  </div>;
}
