"use client";
import { Fragment, useState } from "react";
import { fmtDate, fmtNum, followupPost, useFollowup, useT } from "./shared";
import { FOLLOWUP_REASON, FOLLOWUP_STATUS, label } from "./followupLabels";
import type { FollowupSettings } from "@/lib/followup/settings";

type Channel = { available: boolean; needs?: string };
type Data = {
  settings: FollowupSettings; planningMode: "dry_run" | "live" | null; liveBlockers: string[];
  growthFlags: Record<string, boolean>; enabledRules: string[]; quietHours: { start: number; end: number };
  channels: Record<string, Channel>; counts: { mode: string; status: string; n: number }[]; due: number; lastProcessedAt: string | null;
};

/** Follow-up engine control: what it would do, what blocks real sending, and its safe settings. */
export default function FollowupEngineTab() {
  const { t, fa, lang } = useT();
  const { data, error, loading, reload } = useFollowup<Data>("view=engine");
  const [draft, setDraft] = useState<FollowupSettings | null>(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  if (error) return <p className="gc-error" role="alert">{error}</p>;
  if (loading && !data) return <div className="gc-skeleton"/>;
  if (!data) return null;
  const s = draft ?? data.settings;
  const set = (next: Partial<FollowupSettings>) => setDraft({ ...s, ...next });
  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true); setErr(""); setMsg("");
    try { const r = await followupPost(body); setMsg(ok + (r.plan ? ` · ${t("برنامه‌ریزی", "planned")}: ${r.plan.planned} · ${t("پردازش", "processed")}: ${r.processed.claimed}` : r.cancelled != null ? ` · ${r.cancelled}` : "")); setDraft(null); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); }
  }
  const live = data.planningMode === "live";
  const num = (k: "per24h" | "per7d", v: string) => set({ caps: { ...s.caps, [k]: Math.max(1, Number(v) || 1) } });
  const statusTotals = Object.entries(data.counts.reduce<Record<string, number>>((m, c) => { const k = `${c.mode}:${c.status}`; m[k] = (m[k] ?? 0) + c.n; return m; }, {}));
  const CH: Record<string, [string, string]> = { in_app: ["اعلان داخل برنامه", "In-app notification"], email: ["ایمیل", "Email"], push: ["پوش موبایل", "Mobile push"], sms: ["پیامک", "SMS"], whatsapp: ["واتس‌اپ", "WhatsApp"], instagram_dm: ["دایرکت اینستاگرام", "Instagram DM"] };

  return <div className="gc-grid">
    <div className={`gc-banner ${live ? "gc-live" : ""}`} role="status">
      {data.planningMode === null ? t("موتور پیگیری خاموش است: هیچ کاری برنامه‌ریزی یا ارسال نمی‌شود.", "The follow-up engine is off: nothing is planned or sent.")
        : live ? t("ارسال واقعی روشن است: قواعد فعال، با سقف‌ها و ساعت سکوت، به کاربران پیام می‌فرستند.", "Live sending is ON: enabled rules message users, within caps and quiet hours.")
        : t("حالت آزمایشی: موتور فقط ثبت می‌کند چه پیامی به چه کسی ارسال می‌شد. هیچ پیامی ارسال نمی‌شود.", "Dry-run mode: the engine only records what it would send to whom. Nothing is sent.")}
    </div>
    {!!data.liveBlockers.length && <section className="gc-card"><h2>{t("چه چیزی جلوی ارسال واقعی را گرفته", "What blocks real sending")}</h2>
      <ul className="gc-sub">{data.liveBlockers.map(b => <li key={b}>{label(FOLLOWUP_REASON, b, fa)}</li>)}</ul>
      <p className="gc-sub">{t("ارسال واقعی فقط وقتی ممکن است که همهٔ این موارد را مدیر ارشد آگاهانه روشن کند.", "Real sending is possible only after a super admin deliberately clears every item.")}</p></section>}

    <section className="gc-card"><h2>{t("صف و نتیجه‌ها", "Queue and outcomes")}</h2>
      <dl className="gc-kv"><dt>{t("آمادهٔ پردازش", "Due now")}</dt><dd>{fmtNum(data.due, lang)}</dd><dt>{t("آخرین پردازش", "Last processed")}</dt><dd>{data.lastProcessedAt ? fmtDate(data.lastProcessedAt, lang) : "—"}</dd>
        {statusTotals.map(([k, n]) => { const [mode, status] = k.split(":"); return <Fragment key={k}><dt>{label(FOLLOWUP_STATUS, status, fa)} <span className="gc-pill">{mode === "live" ? t("واقعی", "live") : t("آزمایشی", "dry run")}</span></dt><dd>{fmtNum(n, lang)}</dd></Fragment>; })}
      </dl></section>

    <section className="gc-card"><h2>{t("کانال‌ها", "Channels")}</h2>
      <div className="gc-table-wrap"><table><thead><tr><th>{t("کانال", "Channel")}</th><th>{t("روی سرور", "On the server")}</th><th>{t("نیاز دارد", "Needs")}</th></tr></thead><tbody>
        {Object.entries(data.channels).map(([k, c]) => <tr key={k}><td>{CH[k]?.[fa ? 0 : 1] ?? k}</td><td>{c.available ? t("آماده", "Available") : t("در دسترس نیست", "Not available")}</td><td className="gc-sub" dir="ltr">{c.needs ?? "—"}</td></tr>)}
      </tbody></table></div></section>

    <section className="gc-card"><h2>{t("تنظیمات موتور", "Engine settings")}</h2>
      <p className="gc-sub">{t("روشن‌کردن حالت واقعی، هر کانال یا کمپین لایو فقط با نقش مدیر ارشد ممکن است و در گزارش ممیزی ثبت می‌شود.", "Turning on live mode, any channel or the Live campaign needs a super admin and is audited.")}</p>
      <div className="gc-form" style={{ marginTop: 10 }}>
        <label className="gc-switch"><input type="checkbox" checked={s.engine_enabled} onChange={e => set({ engine_enabled: e.target.checked })}/>{t("موتور روشن", "Engine on")}</label>
        <label>{t("حالت", "Mode")}<select value={s.mode} onChange={e => set({ mode: e.target.value as FollowupSettings["mode"] })}><option value="dry_run">{t("آزمایشی (فقط ثبت)", "Dry run (record only)")}</option><option value="live">{t("واقعی (ارسال)", "Live (send)")}</option></select></label>
        {(["in_app", "email", "push"] as const).map(c => <label key={c} className="gc-switch"><input type="checkbox" checked={s.channels[c]} onChange={e => set({ channels: { ...s.channels, [c]: e.target.checked } })}/>{CH[c][fa ? 0 : 1]}</label>)}
        <label>{t("حداکثر پیام در ۲۴ ساعت", "Max per 24 hours")}<input type="number" min={1} max={5} value={s.caps.per24h} onChange={e => num("per24h", e.target.value)}/></label>
        <label>{t("حداکثر پیام در ۷ روز", "Max per 7 days")}<input type="number" min={1} max={20} value={s.caps.per7d} onChange={e => num("per7d", e.target.value)}/></label>
        <label>{t("تعداد تلاش ارسال", "Send attempts")}<input type="number" min={1} max={10} value={s.retry.maxAttempts} onChange={e => set({ retry: { ...s.retry, maxAttempts: Number(e.target.value) || 1 } })}/></label>
        <label>{t("انقضا (ساعت)", "Expire after (hours)")}<input type="number" min={6} max={336} value={s.expireHours} onChange={e => set({ expireHours: Number(e.target.value) || 72 })}/></label>
        <label>{t("گروه کنترل (٪)", "Holdout (%)")}<input type="number" min={0} max={50} value={s.holdoutPercent} onChange={e => set({ holdoutPercent: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}/></label>
        <label>{t("پنجرهٔ تبدیل (روز)", "Conversion window (days)")}<input type="number" min={1} max={60} value={s.conversionWindowDays} onChange={e => set({ conversionWindowDays: Number(e.target.value) || 7 })}/></label>
        <label className="gc-switch"><input type="checkbox" checked={s.live_campaign_enabled} onChange={e => set({ live_campaign_enabled: e.target.checked })}/>{t("کمپین اینستاگرام AIFekr لایو", "AIFekr Live Instagram campaign")}</label>
      </div>
      <p className="gc-sub">{t(`ساعت سکوت تهران: ${data.quietHours.start} تا ${data.quietHours.end} (در تنظیمات رشد). پیام‌های این بازه به بعد از آن منتقل می‌شوند.`, `Tehran quiet hours: ${data.quietHours.start}–${data.quietHours.end} (in Growth settings). Messages due then wait until it ends.`)}</p>
      {err && <p className="gc-error" role="alert">{err === "SUPER_ADMIN_REQUIRED" ? t("این تغییر فقط با نقش مدیر ارشد ممکن است.", "Only a super admin can make this change.") : err}</p>}
      {msg && <p className="gc-sub" role="status">{msg}</p>}
      <div className="gc-toolbar">
        <button className="gc-btn gc-primary" disabled={busy || !draft} onClick={() => void act({ action: "saveSettings", settings: s }, t("ذخیره شد", "Saved"))}>{t("ذخیرهٔ تنظیمات", "Save settings")}</button>
        {draft && <button className="gc-btn" disabled={busy} onClick={() => setDraft(null)}>{t("انصراف", "Discard")}</button>}
        <button className="gc-btn" disabled={busy || !data.settings.engine_enabled || !!draft} onClick={() => void act({ action: "runNow" }, live ? t("اجرا شد (واقعی)", "Ran (live)") : t("اجرای آزمایشی انجام شد", "Dry run done"))}>{live ? t("اجرای الان (ارسال واقعی)", "Run now (sends for real)") : t("اجرای آزمایشی الان", "Run a dry run now")}</button>
        <button className="gc-btn gc-danger" disabled={busy} onClick={() => { if (confirm(t("همهٔ کارهای در صف لغو شوند؟", "Cancel every queued job?"))) void act({ action: "cancelQueued" }, t("لغو شد", "Cancelled")); }}>{t("لغو همهٔ کارهای در صف", "Cancel all queued")}</button>
      </div>
    </section>
  </div>;
}
