"use client";
import { useState } from "react";
import { fmtNum, growthPost, useGrowth, useT } from "./shared";
import type { GrowthSettings } from "@/lib/growth/config";

type Template = { titleFa: string; bodyFa: string; titleEn: string; bodyEn: string };
type RuleInfo = { key: string; kind: "guidance" | "promotional"; name: [string, string]; when: [string, string]; template: Template; customised: boolean };
type Result = { key: string; eligible: number; wouldSend: number; suppressed: Record<string, number>; sample: { userId: string; name: string | null; channel: string; title: string }[] };
type Data = { preview: { quiet: boolean; results: Result[] }; rules: RuleInfo[]; variables: string[]; messaging: GrowthSettings["messaging"]; flags: GrowthSettings["flags"]; history: { ruleKey: string; status: string; _count: { _all: number } }[] };

export default function AutomationsTab() {
  const { t, lang, fa } = useT();
  const { data, error, loading, reload } = useGrowth<Data>("view=automations");
  const [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState<Template | null>(null), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState("");
  async function saveMessaging(next: GrowthSettings["messaging"]) {
    setBusy(true); setSaveError("");
    try {
      const { settings } = await growthPost({ action: "saveSettings", settings: await fetch("/api/admin/growth?view=settings", { cache: "no-store" }).then(r => r.json()).then(d => ({ ...d.settings, messaging: next })) });
      void settings; setEditing(null); reload();
    } catch (e) { setSaveError(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); }
  }
  if (error) return <p className="gc-error" role="alert">{error}</p>;
  if (loading && !data) return <div className="gc-skeleton"/>;
  if (!data) return null;
  const live = data.flags.lifecycle_automation_enabled && data.flags.automated_communications_enabled;
  const reason: Record<string, string> = { unsubscribed: t("لغو اشتراک", "unsubscribed"), frequency_cap: t("سقف تعداد پیام", "frequency cap"), already_sent: t("قبلاً ارسال شده", "already sent"), paid_customer: t("مشتری پولی", "paying customer") };
  return <div className="gc-grid">
    <div className={`gc-banner ${live ? "gc-live" : ""}`} role="status">{live
      ? t("ارسال واقعی روشن است: قواعدِ فعال در اجرای زمان‌بندی‌شده پیام می‌فرستند.", "Live sending is ON: enabled rules send messages on the scheduled run.")
      : t("حالت آزمایشی: هیچ پیامی ارسال نمی‌شود. آمار زیر فقط پیش‌نمایش است. برای ارسال واقعی، مدیر ارشد باید هر دو سوییچ «اتوماسیون چرخهٔ عمر» و «ارسال خودکار پیام» را در تنظیمات روشن کند و قاعده را فعال کند.", "Dry-run: nothing is sent. The numbers below are a preview only. To send, a super admin must turn on both 'lifecycle automation' and 'automated communications' in Settings and enable the rule.")}
      {data.preview.quiet && <> {t("(الان ساعت سکوت تهران است.)", "(Tehran quiet hours right now.)")}</>}</div>
    <p className="gc-sub">{t(`سقف: یک پیام در هر ${data.messaging.minHoursBetween} ساعت و حداکثر ${data.messaging.maxPer14Days} پیام در ۱۴ روز برای هر کاربر. ایمیل فقط با رضایت صریح؛ لغوکنندگان هیچ پیامی نمی‌گیرند. قواعد تبلیغاتی به مشتری پولی نمی‌رسند.`, `Caps: one message per ${data.messaging.minHoursBetween}h and at most ${data.messaging.maxPer14Days} per 14 days per user. Email only with explicit consent; unsubscribed users get nothing. Promotional rules never reach paying customers.`)}</p>
    {saveError && <p className="gc-error" role="alert">{saveError}</p>}
    {data.rules.map(rule => {
      const r = data.preview.results.find(x => x.key === rule.key), enabled = data.messaging.enabledRules.includes(rule.key);
      const sent = data.history.filter(h => h.ruleKey === rule.key && h.status === "sent").reduce((n, h) => n + h._count._all, 0);
      return <section key={rule.key} className="gc-rule gc-card">
        <div className="gc-rule-head"><div><h3>{rule.name[fa ? 0 : 1]} <span className="gc-pill">{rule.kind === "promotional" ? t("تبلیغاتی", "promotional") : t("راهنما", "guidance")}</span></h3><p className="gc-sub">{rule.when[fa ? 0 : 1]}</p></div>
          <label className="gc-switch"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => void saveMessaging({ ...data.messaging, enabledRules: e.target.checked ? [...data.messaging.enabledRules, rule.key] : data.messaging.enabledRules.filter(k => k !== rule.key) })}/>{enabled ? t("فعال", "Enabled") : t("خاموش", "Off")}</label></div>
        <div className="gc-stats"><span>{t("واجد شرایط الان", "Eligible now")}: <b>{fmtNum(r?.eligible ?? 0, lang)}</b></span><span>{t("دریافت می‌کردند", "Would receive")}: <b>{fmtNum(r?.wouldSend ?? 0, lang)}</b></span>{Object.entries(r?.suppressed ?? {}).map(([k, v]) => <span key={k}>{reason[k] ?? k}: <b>{fmtNum(v, lang)}</b></span>)}<span>{t("ارسال‌شده تاکنون", "Sent so far")}: <b>{fmtNum(sent, lang)}</b></span></div>
        {!!r?.sample.length && <details><summary className="gc-sub">{t("نمونهٔ دریافت‌کنندگان (پیش‌نمایش)", "Sample recipients (preview)")}</summary><ul className="gc-sub">{r.sample.map(s => <li key={s.userId}>{s.name || s.userId} · {s.channel} · “{s.title}”</li>)}</ul></details>}
        {editing === rule.key && draft ? <div className="gc-grid">
          <p className="gc-sub">{t("متغیرهای مجاز", "Allowed variables")}: <span dir="ltr">{data.variables.map(v => `{{${v}}}`).join(" ")}</span></p>
          <div className="gc-form">{(["titleFa", "titleEn"] as const).map(k => <label key={k}>{k}<input value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} dir={k.endsWith("Fa") ? "rtl" : "ltr"}/></label>)}</div>
          <div className="gc-form">{(["bodyFa", "bodyEn"] as const).map(k => <label key={k}>{k}<textarea value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} dir={k.endsWith("Fa") ? "rtl" : "ltr"}/></label>)}</div>
          <div className="gc-toolbar"><button className="gc-btn gc-primary" disabled={busy} onClick={() => void saveMessaging({ ...data.messaging, templates: { ...data.messaging.templates, [rule.key]: draft } })}>{t("ذخیرهٔ متن", "Save text")}</button>{rule.customised && <button className="gc-btn" disabled={busy} onClick={() => { const rest = { ...data.messaging.templates }; delete rest[rule.key]; void saveMessaging({ ...data.messaging, templates: rest }); }}>{t("بازگشت به متن پیش‌فرض", "Reset to default")}</button>}<button className="gc-btn" onClick={() => setEditing(null)}>{t("انصراف", "Cancel")}</button></div>
        </div> : <div className="gc-sub"><b>{fa ? rule.template.titleFa : rule.template.titleEn}</b> — {fa ? rule.template.bodyFa : rule.template.bodyEn} <button className="gc-btn" style={{ minHeight: 30, marginInlineStart: 6 }} onClick={() => { setEditing(rule.key); setDraft(rule.template); }}>{t("ویرایش متن", "Edit text")}</button>{rule.customised && <span className="gc-pill">{t("سفارشی", "custom")}</span>}</div>}
      </section>;
    })}
  </div>;
}
