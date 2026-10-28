"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { ACTION_LABELS, BAND_LABELS, Missing, SEGMENT_LABELS, STAGE_LABELS, fmtDate, fmtNum, growthPost, useGrowth, useT } from "./shared";
import "./growth-center.css";

type Touch = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null; referrerHost: string | null; landingPath: string; createdAt: string } | null;
type Detail = {
  user: { id: string; name: string | null; email: string | null; phone: string | null; role: string; accountType: string; language: string | null; createdAt: string; lastLoginAt: string | null; plan: string; planExpiry: string | null; credits: number; isBlocked: boolean };
  profile: { attributionConfidence: string; intendedModule: string | null; objective: string | null; persona: string | null; intent: string | null; onboardingState: string; marketingConsent: boolean; consentAt: string | null; consentSource: string | null; unsubscribedAt: string | null; followUpStatus: string; assignedAdminId: string | null } | null;
  touches: { first: Touch; last: Touch; count: number };
  facts: { successes: Record<string, { count: number; first: string; name: [string, string] }>; failedOperations: number; creditsUsedWindow: number; activeDaysWindow: number; lastActiveAt: string | null; pricingViewsWindow: number; checkoutsWindow: number; payments: { success: number; failed: number; pending: number; revenueToman: number } };
  intelligence: { stage: string; score: number; band: string; lines: { rule: string; points: number; evidence: string }[]; segments: string[]; risks: string[]; firstValueAt: string | null; nextAction: string };
  payments: { id: string; plan: string; amount: number; status: string; gateway: string; createdAt: string }[];
  notes: { id: string; body: string; authorId: string; createdAt: string }[];
  timeline: { at: string; type: string; label: string; detail: string | null }[];
};

function TouchView({ touch }: { touch: Touch }) {
  const { t } = useT();
  if (!touch) return <Missing>{t("نامشخص — شاهدی ثبت نشده", "Unknown — no evidence recorded")}</Missing>;
  return <span dir="ltr">{[touch.utmSource, touch.utmMedium, touch.utmCampaign, touch.utmContent, touch.utmTerm].filter(Boolean).join(" / ") || touch.referrerHost} · {touch.landingPath}</span>;
}

export default function CustomerProfile({ userId }: { userId: string }) {
  const { t, lang, fa } = useT();
  const { data, error, loading, reload } = useGrowth<Detail>(`view=customer&id=${encodeURIComponent(userId)}`);
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(""), [filter, setFilter] = useState("");
  const act = async (body: Record<string, unknown>) => { setBusy(true); setActionError(""); try { await growthPost(body); reload(); } catch (e) { setActionError(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); } };
  const Back = fa ? ArrowRight : ArrowLeft;
  if (error) return <div className="gc"><p className="gc-error" role="alert">{error}</p></div>;
  if (loading && !data) return <div className="gc"><div className="gc-skeleton"/></div>;
  if (!data) return null;
  const { user, profile, facts, intelligence: ai } = data;
  const types = [...new Set(data.timeline.map(e => e.type))];
  return <div className="gc" dir={fa ? "rtl" : "ltr"}>
    <Link href="/admin/customer-growth#customers" className="gc-btn" style={{ marginBottom: 12 }}><Back size={16}/>{t("مرکز رشد", "Growth Center")}</Link>
    <header className="gc-head"><div><h1>{user.name || user.email || user.phone}</h1><p className="gc-sub" dir="ltr">{[user.email, user.phone].filter(Boolean).join(" · ")}</p></div>
      <div className="gc-toolbar"><span className={`gc-pill gc-stage-${ai.stage}`}>{STAGE_LABELS[ai.stage]?.[fa ? 0 : 1]}</span><span className={`gc-pill gc-band-${ai.band}`}>{fmtNum(ai.score, lang)} · {BAND_LABELS[ai.band]?.[fa ? 0 : 1]}</span><Link className="gc-btn" href={`/admin/users/${user.id}`}>{t("پروفایل حساب", "Account profile")}</Link></div></header>
    <div className="gc-grid gc-two">
      <section className="gc-card"><h2>{t("هویت", "Identity")}</h2><dl className="gc-kv">
        <dt>{t("ثبت‌نام", "Registered")}</dt><dd>{fmtDate(user.createdAt, lang)}</dd><dt>{t("آخرین ورود", "Last login")}</dt><dd>{fmtDate(user.lastLoginAt, lang)}</dd>
        <dt>{t("زبان", "Language")}</dt><dd>{user.language || "—"}</dd><dt>{t("نوع حساب", "Account type")}</dt><dd>{user.accountType}</dd><dt>{t("وضعیت", "Status")}</dt><dd>{user.isBlocked ? t("مسدود", "Blocked") : t("فعال", "Active")}</dd>
      </dl></section>
      <section className="gc-card"><h2>{t("منبع ورود", "Acquisition")}</h2><dl className="gc-kv">
        <dt>{t("اولین تماس", "First touch")}</dt><dd><TouchView touch={data.touches.first}/></dd><dt>{t("آخرین تماس", "Last touch")}</dt><dd><TouchView touch={data.touches.last}/></dd>
        <dt>{t("اطمینان", "Confidence")}</dt><dd>{profile?.attributionConfidence ?? "unknown"}</dd><dt>{t("ماژول هدف", "Intended module")}</dt><dd>{profile?.intendedModule || "—"}</dd>
        <dt>{t("پاسخ‌های آشنایی", "Onboarding answers")}</dt><dd>{[profile?.objective, profile?.persona, profile?.intent].filter(Boolean).join(" · ") || "—"} ({profile?.onboardingState ?? "not_started"})</dd>
      </dl></section>
      <section className="gc-card"><h2>{t("استفاده از محصول", "Product usage")}</h2><dl className="gc-kv">
        <dt>{t("نتیجهٔ اول", "First value")}</dt><dd>{ai.firstValueAt ? fmtDate(ai.firstValueAt, lang) : <Missing>{t("هنوز نه", "Not yet")}</Missing>}</dd>
        <dt>{t("ماژول‌ها (نتیجهٔ واقعی)", "Modules (real results)")}</dt><dd>{Object.values(facts.successes).map(s => `${s.name[fa ? 0 : 1]} ×${fmtNum(s.count, lang)}`).join(" · ") || "—"}</dd>
        <dt>{t("عملیات ناموفق (بازپرداخت)", "Failed (refunded) ops")}</dt><dd>{fmtNum(facts.failedOperations, lang)}</dd><dt>{t("روزهای فعال", "Active days")}</dt><dd>{fmtNum(facts.activeDaysWindow, lang)}</dd>
        <dt>{t("کردیت مصرفی", "Credits used")}</dt><dd>{fmtNum(facts.creditsUsedWindow, lang)}</dd><dt>{t("آخرین فعالیت", "Last activity")}</dt><dd>{fmtDate(facts.lastActiveAt, lang)}</dd>
      </dl></section>
      <section className="gc-card"><h2>{t("اشتراک و پرداخت", "Subscription & billing")}</h2><dl className="gc-kv">
        <dt>{t("پلن", "Plan")}</dt><dd>{user.plan}{user.planExpiry ? ` · ${t("تا", "until")} ${fmtDate(user.planExpiry, lang)}` : ""}</dd><dt>{t("کردیت", "Credits")}</dt><dd>{fmtNum(user.credits, lang)}</dd>
        <dt>{t("پرداخت‌ها", "Payments")}</dt><dd>{t("موفق", "success")} {fmtNum(facts.payments.success, lang)} · {t("ناموفق", "failed")} {fmtNum(facts.payments.failed, lang)} · {t("باز", "pending")} {fmtNum(facts.payments.pending, lang)}</dd>
        <dt>{t("درآمد", "Revenue")}</dt><dd>{fmtNum(facts.payments.revenueToman, lang)} {t("تومان", "Toman")}</dd>
      </dl></section>
      <section className="gc-card"><h2>{t("هوش مشتری", "Customer intelligence")}</h2>
        <p className="gc-sub">{t("شواهد (از داده):", "Evidence (from data):")}</p>
        <ul className="gc-sub">{ai.lines.length ? ai.lines.map(l => <li key={l.rule}>+{l.points} · {l.rule} — {l.evidence}</li>) : <li>{t("هنوز رفتاری که امتیاز بدهد ثبت نشده.", "No scoring behaviour recorded yet.")}</li>}</ul>
        <p className="gc-sub">{t("بخش‌ها", "Segments")}: {ai.segments.map(s => SEGMENT_LABELS[s]?.[fa ? 0 : 1] ?? s).join("، ") || "—"}</p>
        {!!ai.risks.length && <p className="gc-error">{t("نشانه‌های خطر", "Risk signals")}: {ai.risks.join(", ")}</p>}
        <p><b>{t("اقدام پیشنهادی (توصیه، نه اجرای خودکار)", "Suggested action (advice, not automatic)")}:</b> {ACTION_LABELS[ai.nextAction]?.[fa ? 0 : 1]}</p>
      </section>
      <section className="gc-card"><h2>{t("پیگیری و ارتباط", "Follow-up & communication")}</h2>
        <dl className="gc-kv"><dt>{t("رضایت ایمیل تبلیغاتی", "Marketing email consent")}</dt><dd>{profile?.marketingConsent ? `${t("بله", "Yes")} · ${profile.consentSource ?? ""} · ${fmtDate(profile.consentAt, lang)}` : t("خیر", "No")}</dd><dt>{t("پیام‌های پیگیری", "Lifecycle messages")}</dt><dd>{profile?.unsubscribedAt ? `${t("متوقف", "Stopped")} · ${fmtDate(profile.unsubscribedAt, lang)}` : t("مجاز", "Allowed")}</dd></dl>
        <div className="gc-toolbar" style={{ marginTop: 10 }}>
          <label>{t("وضعیت پیگیری", "Follow-up status")}<select value={profile?.followUpStatus ?? "none"} disabled={busy} onChange={e => void act({ action: "followUp", userId: user.id, status: e.target.value, assign: true })}>{["none", "open", "contacted", "resolved"].map(s => <option key={s}>{s}</option>)}</select></label>
          {!profile?.unsubscribedAt && <button className="gc-btn gc-danger" disabled={busy} onClick={() => { if (confirm(t("پیام‌های پیگیری این کاربر متوقف شود؟", "Stop lifecycle messages for this user?"))) void act({ action: "stopMessages", userId: user.id }); }}>{t("توقف پیام‌ها", "Stop messages")}</button>}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (note.trim()) void act({ action: "addNote", userId: user.id, text: note }).then(() => setNote("")); }} style={{ marginTop: 10 }}><label>{t("یادداشت داخلی", "Internal note")}<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000}/></label><button className="gc-btn" disabled={busy || !note.trim()} style={{ marginTop: 6 }}>{t("افزودن یادداشت", "Add note")}</button></form>
        {actionError && <p className="gc-error" role="alert">{actionError}</p>}
        <ul className="gc-timeline">{data.notes.map(n => <li key={n.id}><time>{fmtDate(n.createdAt, lang)}</time><span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span></li>)}</ul>
      </section>
    </div>
    <section className="gc-card" style={{ marginTop: 12 }}><div className="gc-rule-head"><h2>{t("خط زمانی", "Timeline")}</h2><div className="gc-chips"><button aria-pressed={!filter} onClick={() => setFilter("")}>{t("همه", "All")}</button>{types.map(x => <button key={x} aria-pressed={filter === x} onClick={() => setFilter(x)}>{x}</button>)}</div></div>
      <p className="gc-sub">{t("متن پرامپت‌ها و محتوای تولیدشده نمایش داده نمی‌شود.", "Prompt text and generated content are never shown.")}</p>
      <ol className="gc-timeline">{data.timeline.filter(e => !filter || e.type === filter).map((e, i) => <li key={i}><time>{new Date(e.at).toLocaleString(fa ? "fa-IR" : "en-GB")}</time><span><span className="gc-pill">{e.type}</span> <b>{e.label}</b>{e.detail ? <span className="gc-sub"> · {e.detail}</span> : null}</span></li>)}</ol>
    </section>
  </div>;
}
