"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MessageCircle, Send, ShieldCheck, Smartphone, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { tri, type Lang } from "@/lib/i18n";

type RecentPost = {
  id: string;
  caption: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
};

export default function InstagramCommentAutomationBuilder({
  posts,
  lang,
  onCreated,
}: {
  posts: RecentPost[];
  lang: Lang;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [postId, setPostId] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [publicReply, setPublicReply] = useState("");
  const [followGate, setFollowGate] = useState(false);
  const [followPrompt, setFollowPrompt] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedPost = posts.find((post) => post.id === postId);
  const firstKeyword = keyword.split(/[,،]/).map((value) => value.trim()).find(Boolean) || "aifekr";
  const previewMessage = useMemo(() => {
    const personalized = (dmMessage || tri(lang, "پیام اختصاصی شما اینجا نمایش داده می‌شود…", "Your custom DM appears here…", "Ihre Nachricht erscheint hier…")).replaceAll("{username}", "@customer");
    return linkLabel.trim() && linkUrl.trim() ? `${personalized}\n\n${linkLabel.trim()}: ${linkUrl.trim()}` : personalized;
  }, [dmMessage, lang, linkLabel, linkUrl]);
  const fieldClass = "w-full rounded-xl px-3 py-2.5 text-sm outline-none";
  const fieldStyle = { background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" };

  async function createCampaign() {
    if (!name.trim() || !keyword.trim() || !dmMessage.trim()) {
      toast.error(tri(lang, "نام، کلمهٔ کلیدی و متن دایرکت الزامی است", "Name, keyword, and DM text are required", "Name, Schlüsselwort und DM-Text sind erforderlich"));
      setStep(!name.trim() || !keyword.trim() ? 0 : 1);
      return;
    }
    setSaving(true);
    try {
      const links = linkLabel.trim() && linkUrl.trim() ? [{ label: linkLabel.trim(), url: linkUrl.trim() }] : [];
      const response = await fetch("/api/social/instagram/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), keyword: keyword.trim(), dmMessage: dmMessage.trim(),
          publicReplyMessage: publicReply.trim() || undefined, postId: postId || undefined,
          links: links.length ? links : undefined,
          followGateEnabled: followGate,
          followGatePrompt: followGate ? followPrompt.trim() || undefined : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tri(lang, "ساخت کمپین ناموفق بود", "Could not create campaign", "Kampagne konnte nicht erstellt werden"));
      toast.success(tri(lang, "کمپین ساخته شد", "Automation created", "Automation erstellt"));
      setStep(0); setName(""); setKeyword(""); setPostId(""); setDmMessage(""); setPublicReply("");
      setFollowGate(false); setFollowPrompt(""); setLinkLabel(""); setLinkUrl("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tri(lang, "خطای نامشخص", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    tri(lang, "محرک", "Trigger", "Auslöser"),
    tri(lang, "پیام", "Message", "Nachricht"),
    tri(lang, "قوانین", "Rules", "Regeln"),
  ];

  return (
    <div className="rounded-2xl p-4 md:p-5 mb-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{tri(lang, "سازندهٔ اتوماسیون کامنت به دایرکت", "Comment-to-DM automation builder", "Kommentar-zu-DM-Automation erstellen")}</h3>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "یک بار تنظیم کن؛ برای هر پست، پیام هدفمند بفرست.", "Set it up once and send a tailored DM for each post.", "Einmal einrichten und passende DMs je Beitrag senden.")}</p>
        </div>
        <div className="flex items-center gap-1" aria-label={tri(lang, "مراحل ساخت", "Setup steps", "Einrichtungsschritte")}>
          {steps.map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index)} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px]" style={{ background: step === index ? "rgba(34,197,94,.16)" : "transparent", color: step === index ? "#22c55e" : "var(--text-muted)" }}>
              <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px]" style={{ background: index < step ? "#22c55e" : "var(--surface-1)", color: index < step ? "white" : "inherit" }}>{index < step ? <Check className="w-3 h-3" /> : index + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {step === 0 && <div className="space-y-4">
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نام اتوماسیون", "Automation name", "Name der Automation")}
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder={tri(lang, "مثلاً پیشنهاد ویژه پست جدید", "e.g. New post offer", "z. B. Angebot für neuen Beitrag")} className={`${fieldClass} mt-1.5`} style={fieldStyle} />
            </label>
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "کلمه یا کلمات محرک", "Trigger keyword(s)", "Schlüsselwort(er)")}
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={tri(lang, "مثلاً aifekr، قیمت (با کاما جدا کن)", "e.g. aifekr, price (comma-separated)", "z. B. aifekr, Preis (durch Komma trennen)")} className={`${fieldClass} mt-1.5`} style={fieldStyle} />
            </label>
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "این قانون روی کدام پست اجرا شود؟", "Which post should trigger this rule?", "Welcher Beitrag löst diese Regel aus?")}
              <select value={postId} onChange={(event) => setPostId(event.target.value)} className={`${fieldClass} mt-1.5`} style={fieldStyle}>
                <option value="">{tri(lang, "همهٔ پست‌ها", "All posts", "Alle Beiträge")}</option>
                {posts.map((post) => <option key={post.id} value={post.id}>{(post.caption || post.id).slice(0, 70)} · {new Date(post.timestamp).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US")}</option>)}
              </select>
              {!posts.length && <span className="block mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "فهرست پست‌ها در دسترس نیست؛ اتصال و دسترسی خواندن رسانه را بررسی کن.", "Posts are unavailable; check the account connection and media permissions.", "Beiträge nicht verfügbar; Verbindung und Medienberechtigungen prüfen.")}</span>}
            </label>
          </div>}

          {step === 1 && <div className="space-y-4">
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "متن دایرکت خصوصی", "Private DM message", "Private DM-Nachricht")}
              <textarea value={dmMessage} onChange={(event) => setDmMessage(event.target.value)} maxLength={1000} rows={5} placeholder={tri(lang, "سلام {username}، ممنون از کامنتت! این لینک مخصوص همین پسته…", "Hey {username}, thanks for commenting! Here's the link for this post…", "Hallo {username}, danke für deinen Kommentar! Hier ist der Link zu diesem Beitrag…")} className={`${fieldClass} mt-1.5 resize-y`} style={fieldStyle} />
              <span className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}><span>{tri(lang, "برای شخصی‌سازی از {username} استفاده کن.", "Use {username} to personalize the message.", "Nutzen Sie {username} zur Personalisierung.")}</span><span>{dmMessage.length}/1000</span></span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "برچسب لینک (اختیاری)", "Link label (optional)", "Link-Beschriftung (optional)")}<input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} maxLength={40} placeholder={tri(lang, "دریافت راهنما", "Get the guide", "Anleitung erhalten")} className={`${fieldClass} mt-1.5`} style={fieldStyle} /></label>
              <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "لینک (اختیاری)", "Link (optional)", "Link (optional)")}<input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} type="url" dir="ltr" placeholder="https://…" className={`${fieldClass} mt-1.5`} style={fieldStyle} /></label>
            </div>
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پاسخ عمومی زیر کامنت (اختیاری)", "Public comment reply (optional)", "Öffentliche Kommentarantwort (optional)")}<input value={publicReply} onChange={(event) => setPublicReply(event.target.value)} maxLength={220} placeholder={tri(lang, "پیامت رو دایرکت کردیم 📩", "We've sent you a DM 📩", "Wir haben dir eine DM geschickt 📩")} className={`${fieldClass} mt-1.5`} style={fieldStyle} /></label>
          </div>}

          {step === 2 && <div className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={followGate} onChange={(event) => setFollowGate(event.target.checked)} className="w-4 h-4 accent-green-500" />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{tri(lang, "دروازهٔ فالو", "Follow gate", "Follow-Gate")}</span>
                <ShieldCheck className="w-4 h-4 ms-auto" style={{ color: "#22c55e" }} />
              </label>
              <p className="text-[11px] mt-2 leading-5" style={{ color: "var(--text-muted)" }}>{tri(lang, "محتوای اصلی تا کلیک کاربر روی دکمهٔ تأیید نگه داشته می‌شود. Meta فالو را خودکار برای ما تأیید نمی‌کند؛ این تأیید خوداظهاری است.", "The payload waits until the person taps a confirmation button. Meta does not let us verify the follow automatically; this is self-reported.", "Der Inhalt wartet auf eine Bestätigung per Button. Meta erlaubt keine automatische Follow-Prüfung; die Bestätigung erfolgt selbst.")}</p>
              {followGate && <input value={followPrompt} onChange={(event) => setFollowPrompt(event.target.value)} maxLength={220} placeholder={tri(lang, "متن دعوت به فالو (اختیاری)", "Follow prompt (optional)", "Follow-Aufforderung (optional)")} className={`${fieldClass} mt-3`} style={fieldStyle} />}
            </div>
            <div className="rounded-xl p-4 text-xs leading-5" style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.2)", color: "var(--text-secondary)" }}>
              {tri(lang, "وضعیت تایپ و تأخیر تصادفی برای پیام‌های ورودی دایرکت پشتیبانی می‌شوند؛ endpoint پاسخ خصوصی به کامنت این امکانات را ارائه نمی‌کند. برای جلوگیری از تأخیر/ارسال تکراری، این گزینه‌ها در این نوع کمپین نمایش داده نمی‌شوند.", "Typing indicators and randomized delay are supported for inbound DMs; Instagram's private-reply-to-comment endpoint does not provide these features. They are intentionally not offered here to avoid delayed or duplicate sends.", "Schreibindikatoren und zufällige Verzögerungen gelten für eingehende DMs; Metas Private-Reply-Kommentar-Endpunkt bietet diese Funktionen nicht. Sie werden hier nicht angeboten, um verspätete oder doppelte Nachrichten zu vermeiden.")}
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "خلاصهٔ منطق اتوماسیون", "Automation logic", "Automationslogik")}</p>
              <p className="text-xs leading-6" style={{ color: "var(--text-secondary)" }}>{tri(lang, `وقتی کسی زیر ${postId ? "پست انتخاب‌شده" : "یکی از پست‌ها"} عبارت «${firstKeyword}» را کامنت کند، ${followGate ? "پیام تأیید فالو" : "دایرکت خصوصی"} ارسال می‌شود.`, `When someone comments “${firstKeyword}” under ${postId ? "the selected post" : "any post"}, ${followGate ? "a follow-confirmation prompt" : "the private DM"} is sent.`, `Wenn jemand „${firstKeyword}“ unter ${postId ? "dem ausgewählten Beitrag" : "einem Beitrag"} kommentiert, wird ${followGate ? "eine Follow-Bestätigung" : "die private DM"} gesendet.`)}</p>
            </div>
          </div>}

          <div className="flex items-center justify-between gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || saving} className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs disabled:opacity-40" style={{ color: "var(--text-secondary)" }}><ChevronRight className="w-4 h-4" />{tri(lang, "قبلی", "Back", "Zurück")}</button>
            {step < 2 ? <button type="button" onClick={() => setStep((value) => Math.min(2, value + 1))} className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: "#22c55e" }}>{tri(lang, "ادامه", "Continue", "Weiter")}<ChevronLeft className="w-4 h-4" /></button> : <button type="button" onClick={createCampaign} disabled={saving} className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#22c55e" }}><Zap className="w-4 h-4" />{saving ? tri(lang, "در حال ساخت…", "Creating…", "Wird erstellt…") : tri(lang, "ساخت و فعال‌سازی", "Create automation", "Automation erstellen")}</button>}
          </div>
        </div>

        <aside className="flex flex-col items-center rounded-2xl p-3" style={{ background: "#09090b", border: "1px solid #27272a" }}>
          <div className="flex items-center gap-2 self-start px-2 py-1 mb-2 text-[10px] uppercase tracking-[.16em]" style={{ color: "#a1a1aa" }}><Smartphone className="w-3.5 h-3.5" />{tri(lang, "پیش‌نمایش زنده", "Live preview", "Live-Vorschau")}</div>
          <div className="w-full max-w-[230px] overflow-hidden rounded-[26px] border-[5px] border-zinc-800" style={{ background: "#000", minHeight: 350 }}>
            <div className="h-9 px-3 flex items-center justify-between text-[9px] text-zinc-300"><span>9:41</span><span>● ● ▰</span></div>
            <div className="flex items-center gap-2 px-3 pb-2 border-b border-zinc-800"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px]" style={{ background: "#27272a", color: "white" }}>A</div><div><p className="text-[10px] font-semibold text-white">{tri(lang, "حساب کسب‌وکار", "Your business", "Ihr Unternehmen")}</p><p className="text-[8px] text-green-400">{tri(lang, "فعال اکنون", "Active now", "Jetzt aktiv")}</p></div><MessageCircle className="w-3.5 h-3.5 ms-auto text-zinc-400" /></div>
            <div className="p-3 flex flex-col gap-3" style={{ minHeight: 265 }}>
              {selectedPost?.thumbnailUrl || selectedPost?.mediaUrl ? <img src={selectedPost.thumbnailUrl || selectedPost.mediaUrl || ""} alt="Selected Instagram post" className="w-24 h-24 rounded-xl object-cover self-center" /> : <div className="w-24 h-24 rounded-xl flex items-center justify-center self-center text-zinc-600" style={{ background: "#18181b" }}><MessageCircle className="w-6 h-6" /></div>}
              <div className="self-start max-w-[90%] rounded-2xl px-2.5 py-2 text-[9px] text-zinc-100" style={{ background: "#262626" }}>{tri(lang, `کامنت: ${firstKeyword}`, `Comment: ${firstKeyword}`, `Kommentar: ${firstKeyword}`)}</div>
              {followGate && <div className="self-end max-w-[92%] rounded-2xl px-2.5 py-2 text-[9px] text-white" style={{ background: "#3797f0" }}>{followPrompt || tri(lang, "برای دریافت پیام، فالو کن و دکمه را بزن 👇", "Follow and tap below to get the message 👇", "Folgen und unten tippen, um die Nachricht zu erhalten 👇")}<span className="block mt-2 rounded-lg bg-white/20 px-2 py-1 text-center">{tri(lang, "فالو کردم ✅", "I followed ✅", "Ich folge ✅")}</span></div>}
              <div className="self-end max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-2.5 py-2 text-[9px] text-white" style={{ background: "#3797f0" }}>{previewMessage}</div>
            </div>
            <div className="mx-2 mb-2 rounded-full px-3 py-2 text-[8px] text-zinc-500" style={{ background: "#18181b" }}>{tri(lang, "پیام…", "Message…", "Nachricht…")}</div>
          </div>
          <p className="mt-2 text-center text-[10px] leading-4" style={{ color: "#a1a1aa" }}>{tri(lang, "پیش‌نمایش تقریبی است؛ ظاهر نهایی به اپ اینستاگرام وابسته است.", "Preview is illustrative; Instagram controls the final rendering.", "Vorschau ist beispielhaft; Instagram bestimmt die endgültige Darstellung.")}</p>
          <div className="mt-auto pt-3 self-start flex items-center gap-1 text-[10px]" style={{ color: "#a1a1aa" }}><Send className="w-3 h-3" />{tri(lang, "ارسال خصوصی از طریق Meta API", "Private delivery via Meta API", "Private Zustellung über Meta API")}</div>
        </aside>
      </div>
    </div>
  );
}
