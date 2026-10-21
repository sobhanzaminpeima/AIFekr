"use client";

import { useEffect, useMemo, useState } from "react";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n/server";
import { LEAD_FIELD_KEYS, FIELD_LABELS, type LeadFieldsConfig, type LeadFieldKey } from "@/lib/leadgen/fields";

interface Props {
  lang: Lang;
  slug: string;
  title: string;
  titleEn: string | null;
  titleDe: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionDe: string | null;
  fields: LeadFieldsConfig;
  accentColor: string;
  logoUrl: string | null;
  submitLabel: string | null;
  successMessage: string | null;
}

function FieldIcon({ k, color }: { k: LeadFieldKey; color: string }) {
  const common = { width: 18, height: 18, stroke: color, strokeWidth: 1.7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (k === "name") return (<svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
  if (k === "phone") return (<svg viewBox="0 0 24 24" {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1.2.4 2.3.7 3.4a2 2 0 0 1-.5 2.1L8.1 10.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1.1.4 2.2.6 3.4.7a2 2 0 0 1 1.7 2Z" /></svg>);
  if (k === "email") return (<svg viewBox="0 0 24 24" {...common}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>);
  if (k === "company") return (<svg viewBox="0 0 24 24" {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 21V9h6v12M3 9h18" /></svg>);
  return (<svg viewBox="0 0 24 24" {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>);
}

export default function LeadFormClient(p: Props) {
  const isFa = p.lang === "fa";
  const dir = isFa ? "rtl" : "ltr";
  const accent = /^#[0-9a-fA-F]{6}$/.test(p.accentColor) ? p.accentColor : "#ea580c";

  const title = (p.lang === "en" ? p.titleEn : p.lang === "de" ? p.titleDe : null) || p.title;
  const description = (p.lang === "en" ? p.descriptionEn : p.lang === "de" ? p.descriptionDe : null) || p.description || "";

  const [values, setValues] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState(false);

  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    const q = new URLSearchParams(window.location.search);
    return {
      utm_source: q.get("utm_source") || undefined,
      utm_medium: q.get("utm_medium") || undefined,
      utm_campaign: q.get("utm_campaign") || undefined,
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") setEmbedded(window.parent !== window);
  }, []);

  useEffect(() => {
    if (done && embedded) window.parent.postMessage("aifekr-leadform-submitted", "*");
  }, [done, embedded]);

  const shownFields = LEAD_FIELD_KEYS.filter((k) => p.fields[k].show);

  function label(k: LeadFieldKey): string {
    const l = FIELD_LABELS[k];
    return p.lang === "en" ? l.en : p.lang === "de" ? l.de : l.fa;
  }
  function placeholder(k: LeadFieldKey): string {
    const l = label(k).toLowerCase();
    if (k === "message") return tri(p.lang, "پیام خود را بنویسید…", "Write your message…", "Schreiben Sie Ihre Nachricht…");
    return tri(p.lang, `${label(k)} خود را وارد کنید`, `Enter your ${l}`, `${label(k)} eingeben`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const k of shownFields) {
      if (p.fields[k].required && !(values[k] || "").trim()) {
        setError(tri(p.lang, "لطفاً فیلدهای الزامی را پر کنید", "Please fill in the required fields", "Bitte füllen Sie die Pflichtfelder aus"));
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/leadform/${p.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website, ...utm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? tri(p.lang, "درخواست‌های زیاد. کمی بعد دوباره تلاش کنید.", "Too many requests. Try again shortly.", "Zu viele Anfragen. Bitte später erneut versuchen.")
            : tri(p.lang, "ارسال نشد. دوباره تلاش کنید.", "Could not submit. Please try again.", "Senden fehlgeschlagen. Bitte erneut versuchen.")
        );
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setDone(true);
    } catch {
      setError(tri(p.lang, "خطای شبکه", "Network error", "Netzwerkfehler"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir={dir} style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "#0a0705", color: "#f5f5f4", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      {/* ambient AIfekr background */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 85% 15%, rgba(234,88,12,0.35), transparent 55%), radial-gradient(90% 70% at 8% 90%, rgba(249,115,22,0.22), transparent 55%), radial-gradient(60% 60% at 50% 50%, rgba(194,65,12,0.12), transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: "linear-gradient(to top, rgba(10,7,5,0.9), transparent)" }} />
      </div>

      <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(20px,5vw,56px)", gap: 28 }}>
        {/* brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="AiFekr" style={{ height: 30 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>AiFekr</span>
        </div>

        {!embedded && (
          <p style={{ maxWidth: 520, textAlign: "center", fontSize: 15, lineHeight: 1.8, color: "rgba(245,245,244,0.72)", margin: 0 }}>
            {tri(p.lang,
              "راهکارهای مبتنی بر هوش مصنوعی برای رشد سریع‌تر، هوشمندتر و قوی‌تر کسب‌وکار شما.",
              "AI-powered solutions to help your business grow faster, smarter and stronger.",
              "KI-gestützte Lösungen, damit Ihr Unternehmen schneller, intelligenter und stärker wächst.")}
          </p>
        )}

        {/* card */}
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: 22,
            padding: "30px 26px",
            background: "linear-gradient(180deg, rgba(28,22,18,0.92), rgba(18,13,10,0.92))",
            border: "1px solid rgba(234,88,12,0.35)",
            boxShadow: `0 0 0 1px rgba(234,88,12,0.08), 0 30px 80px -20px rgba(234,88,12,0.35), 0 10px 40px rgba(0,0,0,0.6)`,
            backdropFilter: "blur(6px)",
          }}
        >
          {/* icon badge */}
          <div style={{ width: 46, height: 46, margin: "0 auto 14px", borderRadius: 14, border: `1px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(234,88,12,0.12)" }}>
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="" style={{ maxWidth: 30, maxHeight: 30, objectFit: "contain" }} />
            ) : (
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={accent} strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
            )}
          </div>

          {done ? (
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#f5f5f4" }}>
                {p.successMessage || tri(p.lang, "دریافت شد! به‌زودی با شما تماس می‌گیریم.", "Got it! We'll be in touch soon.", "Erhalten! Wir melden uns in Kürze.")}
              </h2>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", margin: "0 0 4px", color: "#fafaf9" }}>{title}</h1>
              {description ? (
                <p style={{ fontSize: 13.5, color: "rgba(245,245,244,0.6)", textAlign: "center", margin: "0 0 20px", lineHeight: 1.7 }}>{description}</p>
              ) : <div style={{ height: 14 }} />}

              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {shownFields.map((k) => (
                  <div key={k}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(245,245,244,0.85)", display: "block", marginBottom: 6 }}>
                      {label(k)}
                      {p.fields[k].required ? <span style={{ color: accent }}> *</span> : null}
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: k === "message" ? "flex-start" : "center" }}>
                      <span style={{ position: "absolute", insetInlineStart: 12, top: k === "message" ? 12 : "50%", transform: k === "message" ? "none" : "translateY(-50%)", opacity: 0.6, display: "flex" }}>
                        <FieldIcon k={k} color="rgba(245,245,244,0.7)" />
                      </span>
                      {k === "message" ? (
                        <textarea value={values[k] || ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} rows={3} placeholder={placeholder(k)} style={{ ...inputStyle, paddingInlineStart: 40, resize: "vertical" }} />
                      ) : (
                        <input type={k === "email" ? "email" : k === "phone" ? "tel" : "text"} value={values[k] || ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} placeholder={placeholder(k)} style={{ ...inputStyle, paddingInlineStart: 40 }} />
                      )}
                    </div>
                  </div>
                ))}

                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

                {error ? <p style={{ fontSize: 12.5, color: "#fca5a5", margin: 0 }}>{error}</p> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 4,
                    background: `linear-gradient(135deg, ${accent}, #f97316)`,
                    color: "#fff",
                    border: 0,
                    borderRadius: 12,
                    padding: "13px 16px",
                    fontSize: 15.5,
                    fontWeight: 800,
                    cursor: submitting ? "default" : "pointer",
                    opacity: submitting ? 0.75 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 10px 30px -8px rgba(234,88,12,0.6)",
                  }}
                >
                  {submitting
                    ? tri(p.lang, "در حال ارسال…", "Sending…", "Senden…")
                    : p.submitLabel || tri(p.lang, "ثبت", "Submit", "Absenden")}
                  {!submitting && <span style={{ fontSize: 18, lineHeight: 1 }}>{isFa ? "←" : "→"}</span>}
                </button>
              </form>
            </>
          )}

          <p style={{ fontSize: 11, color: "rgba(245,245,244,0.4)", textAlign: "center", marginTop: 18 }}>
            {tri(p.lang, "قدرت‌گرفته از ", "Powered by ", "Bereitgestellt von ")}
            <span style={{ color: accent, fontWeight: 700 }}>AiFekr</span>
          </p>
        </div>

        {!embedded && (
          <div style={{ textAlign: "center", color: "rgba(245,245,244,0.5)", fontSize: 11, letterSpacing: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1, color: "rgba(245,245,244,0.8)" }}>AiFekr</div>
            SMARTER TODAY · STRONGER TOMORROW
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(245,245,244,0.14)",
  borderRadius: 11,
  padding: "11px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.04)",
  color: "#f5f5f4",
};
