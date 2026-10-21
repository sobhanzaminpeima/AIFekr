"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation, type Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

/**
 * Passwordless owner login — matches how the owner already reaches the
 * platform (an emailed link, same mechanism as the statement-share link),
 * so there's no password to create or forget for someone who isn't a
 * platform user.
 */
export default function OwnerLoginPage() {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // The owner may not read the same language this page happens to be
  // showing in (e.g. a non-Iranian owner landing here via a browser set to
  // Persian) -- so the language the EMAIL goes out in is its own explicit
  // choice, not silently inherited from the page's own UI language.
  const [emailLang, setEmailLang] = useState<Lang>(lang);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await fetch("/api/owner/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang: emailLang }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  const LANG_OPTIONS: { value: Lang; label: string }[] = [
    { value: "fa", label: "فارسی" },
    { value: "en", label: "English" },
    { value: "de", label: "Deutsch" },
  ];

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-0)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "پنل مالک", "Owner portal", "Eigentümerportal")}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "با ایمیلی که آژانس برایتان ثبت کرده وارد شوید", "Sign in with the email your agency registered for you", "Melden Sie sich mit der von Ihrer Agentur hinterlegten E-Mail-Adresse an")}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="w-8 h-8" style={{ color: "var(--pos)" }} />
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "اگر این ایمیل ثبت شده باشد، لینک ورود برایتان ارسال شد.", "If that email is registered, a login link is on its way.", "Falls diese E-Mail-Adresse hinterlegt ist, ist ein Login-Link unterwegs.")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {tri(lang, "لینک تا ۲۰ دقیقه معتبر است.", "The link is valid for 20 minutes.", "Der Link ist 20 Minuten gültig.")}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tri(lang, "ایمیل شما", "Your email", "Ihre E-Mail-Adresse")}
                dir="ltr"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "زبان ایمیل", "Email language", "Sprache der E-Mail")}
              </label>
              <div className="flex gap-1.5">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmailLang(opt.value)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: emailLang === opt.value ? "var(--primary)" : "var(--surface-2)",
                      color: emailLang === opt.value ? "white" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--primary)" }}
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {tri(lang, "ارسال لینک ورود", "Send login link", "Login-Link senden")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
