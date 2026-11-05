"use client";
import { useState } from "react";
import { Missing, fmtNum, followupPost, useFollowup, useT } from "./shared";

type Data = {
  enabled: boolean;
  status: {
    definition: { utmCampaign: string; keyword: string; landingPath: string; url: string };
    growthCampaign: { id: string; status: string } | null;
    instagram: { connected: boolean; accounts: string[]; expired: number };
    commentCampaigns: { id: string; name: string; isActive: boolean; linkHasUtm: boolean; linkClicks: number; triggerCount: number }[];
    state: "ready" | "needs_comment_campaign" | "not_connected";
  };
  funnel: { comments: Record<string, number>; visits: number; visitors: number; attributedUsers: number; signups: number; liveStarted: number; liveFirstValue: number; buyers: number; revenueToman: number; rates: Record<string, number | null> };
};

/** AIFekr Live Instagram launch: status, the tracked link and the funnel. It never posts, comments or sends on Instagram. */
export default function LiveCampaignCard() {
  const { t, lang } = useT();
  const { data, error, reload } = useFollowup<Data>("view=live");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  if (error) return <p className="gc-error" role="alert">{error}</p>;
  if (!data) return <div className="gc-skeleton"/>;
  const { status: s, funnel: f } = data;
  const state = !data.enabled ? t("غیرفعال (در تنظیمات موتور پیگیری روشن می‌شود)", "Disabled (switch on in follow-up engine settings)")
    : s.state === "ready" ? t("آماده: اینستاگرام وصل است و کمپین «لایو» با لینک ردیابی فعال است", "Ready: Instagram is connected and the «لایو» campaign with the tracked link is active")
    : s.state === "needs_comment_campaign" ? t("اینستاگرام وصل است، ولی کمپین کامنت «لایو» با لینک ردیابی‌شده وجود ندارد", "Instagram is connected, but there is no «لایو» comment campaign with the tracked link")
    : t("اینستاگرام AIFekr با حساب مدیر وصل نیست؛ کمپین نمایش‌داده‌شده ولی غیرفعال است", "AIFekr's Instagram is not connected to an admin account; the campaign is shown as disabled");
  const steps: [string, number | null][] = [
    [t("کامنت‌های پاسخ‌داده‌شده", "Comments answered"), f.comments.sent ?? (Object.keys(f.comments).length ? 0 : null)],
    [t("بازدید از لینک", "Link visits"), f.visits], [t("بازدیدکنندهٔ یکتا", "Unique visitors"), f.visitors], [t("کاربر منتسب", "Attributed users"), f.attributedUsers],
    [t("ثبت‌نام جدید", "New sign-ups"), f.signups], [t("شروع لایو", "Started Live"), f.liveStarted], [t("اولین گفتگوی واقعی (۳۰+ ثانیه)", "First real call (30s+)"), f.liveFirstValue],
    [t("خریدار", "Buyers"), f.buyers],
  ];
  return <section className="gc-card">
    <h2>{t("کمپین اینستاگرام AIFekr لایو", "AIFekr Live Instagram campaign")} <span className="gc-pill" dir="ltr">{s.definition.utmCampaign}</span></h2>
    <p className="gc-sub" role="status">{state}</p>
    <dl className="gc-kv">
      <dt>{t("کلمهٔ کامنت", "Comment keyword")}</dt><dd>«{s.definition.keyword}»</dd>
      <dt>{t("لینک داخل دایرکت", "Link to put in the DM")}</dt><dd className="gc-url" dir="ltr">{s.definition.url}</dd>
      <dt>{t("اینستاگرام", "Instagram")}</dt><dd>{s.instagram.connected ? s.instagram.accounts.map(a => `@${a}`).join(", ") || t("وصل", "connected") : t("وصل نیست", "not connected")}{s.instagram.expired ? ` · ${t("توکن منقضی", "expired token")}: ${s.instagram.expired}` : ""}</dd>
      <dt>{t("کمپین کامنت", "Comment campaign")}</dt><dd>{s.commentCampaigns.length ? s.commentCampaigns.map(c => `${c.name || c.id.slice(0, 6)} · ${c.isActive ? t("فعال", "active") : t("غیرفعال", "inactive")} · ${c.linkHasUtm ? t("لینک ردیابی دارد", "tracked link") : t("لینک بدون UTM", "link without UTM")} · ${t("کلیک", "clicks")} ${fmtNum(c.linkClicks, lang)}`).join(" | ") : t("ندارد", "none")}</dd>
      <dt>{t("رکورد کمپین رشد", "Growth campaign record")}</dt><dd>{s.growthCampaign ? s.growthCampaign.status : <button className="gc-btn" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await followupPost({ action: "ensureLiveCampaign" }); reload(); } catch (e) { setErr(e instanceof Error ? e.message : "FAILED"); } finally { setBusy(false); } }}>{t("ساخت رکورد (پیش‌نویس، چیزی ارسال نمی‌شود)", "Create record (draft, sends nothing)")}</button>}</dd>
    </dl>
    {err && <p className="gc-error" role="alert">{err}</p>}
    <div className="gc-funnel" style={{ marginTop: 12 }}>{steps.map(([l, n]) => <div key={l} className="gc-funnel-row"><span>{l}</span><b>{n == null ? <Missing/> : fmtNum(n, lang)}</b></div>)}</div>
    <p className="gc-sub">{t(`درآمد خریداران بعد از اولین کلیک: ${fmtNum(f.revenueToman, lang)} تومان. شمارش لایو فقط از مدت تماس است؛ متن گفتگوها خوانده نمی‌شود.`, `Revenue from buyers after their first click: ${fmtNum(f.revenueToman, lang)} Toman. Live counts come from call length only; conversation text is never read.`)}</p>
    <p className="gc-sub">{t("برای راه‌اندازی: در فضای کاری‌ای که اینستاگرام AIFekr وصل است، یک کمپین کامنت با کلمهٔ «لایو» و همین لینک بسازید. این صفحه چیزی در اینستاگرام منتشر یا ارسال نمی‌کند.", "To launch: in the workspace where AIFekr's Instagram is connected, create a comment campaign with the keyword «لایو» and this link. This page never posts or sends anything on Instagram.")}</p>
  </section>;
}
