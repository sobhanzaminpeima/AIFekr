"use client";
import { useState } from "react";
import { Missing, fmtNum, useFollowup, useT } from "./shared";
import { FOLLOWUP_REASON, FOLLOWUP_STATUS, label } from "./followupLabels";

type Arm = { n: number; converted: number; revenueToman: number; returned: number; conversionRate: number | null; returnRate: number | null };
type RuleRow = { key: string; kind: string; name: [string, string]; sent: Arm; holdout: Arm; dryRun: Arm; suppressed: Record<string, number>; liftPoints: number | null };
type Data = { windowDays: number; rules: RuleRow[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Per-rule outcomes and conversions; lift only from a real holdout group, never estimated. */
export default function FollowupAnalyticsTab() {
  const { t, fa, lang } = useT();
  const [to, setTo] = useState(() => iso(new Date())), [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const { data, error, loading } = useFollowup<Data>(`view=analytics&from=${from}&to=${to}`);
  const pct = (v: number | null) => v == null ? <Missing/> : `${fmtNum(v, lang)}${fa ? "٪" : "%"}`;
  return <div className="gc-grid">
    <div className="gc-toolbar"><label>{t("از", "From")}<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label><label>{t("تا", "To")}<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label></div>
    {data && <p className="gc-sub">{t(`تبدیل = پرداخت موفق تا ${data.windowDays} روز بعد از پیام (یا بعد از تصمیم گروه کنترل). بازگشت = هر استفاده از کردیت در همان بازه. «اثر» فقط وقتی نمایش داده می‌شود که هر دو گروه حداقل ۳۰ نفر باشند؛ اجرای آزمایشی چیزی ارسال نکرده و فقط برای مقایسه است.`, `Conversion = a successful payment within ${data.windowDays} days after the message (or the holdout decision). Return = any credit use in that window. Lift is shown only when both groups have at least 30 users; dry runs sent nothing and are for comparison only.`)}</p>}
    {error && <p className="gc-error" role="alert">{error}</p>}
    {loading && !data ? <div className="gc-skeleton"/> : data && <div className="gc-table-wrap"><table><thead><tr>
      <th>{t("قاعده", "Rule")}</th><th>{t("ارسال‌شده", "Sent")}</th><th>{t("تبدیل", "Converted")}</th><th>{t("بازگشت", "Returned")}</th><th>{t("گروه کنترل", "Holdout")}</th><th>{t("تبدیل کنترل", "Holdout conv.")}</th><th>{t("اثر (واحد درصد)", "Lift (pts)")}</th><th>{t("آزمایشی", "Dry runs")}</th><th>{t("متوقف/ناموفق", "Suppressed/failed")}</th>
    </tr></thead><tbody>{data.rules.map(r => <tr key={r.key}>
      <td>{r.name[fa ? 0 : 1]}</td>
      <td>{fmtNum(r.sent.n, lang)}</td><td>{fmtNum(r.sent.converted, lang)} · {pct(r.sent.conversionRate)}</td><td>{pct(r.sent.returnRate)}</td>
      <td>{fmtNum(r.holdout.n, lang)}</td><td>{pct(r.holdout.conversionRate)}</td><td>{r.liftPoints == null ? <Missing/> : fmtNum(r.liftPoints, lang)}</td>
      <td>{fmtNum(r.dryRun.n, lang)}</td>
      <td className="gc-sub">{Object.entries(r.suppressed).map(([k, n]) => { const [s, reason] = k.split(":"); return `${label(FOLLOWUP_STATUS, s, fa)} – ${label(FOLLOWUP_REASON, reason === "-" ? null : reason, fa)}: ${fmtNum(n, lang)}`; }).join(" · ") || "—"}</td>
    </tr>)}</tbody></table></div>}
  </div>;
}
