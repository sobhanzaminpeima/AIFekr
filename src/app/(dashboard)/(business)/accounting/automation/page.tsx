"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Send, Pause, Play, Trash2, Eye, KeyRound, Copy, Plus } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";
import { REPORT_CURRENCIES } from "@/lib/accounting/reportingFx";
import AccountingNav from "@/components/accounting/AccountingNav";

interface ScheduledReport {
  id: string;
  reportType: "weekly_summary" | "monthly_pl" | "monthly_vat";
  frequency: "weekly" | "monthly";
  recipientEmail: string;
  status: "pending_first_approval" | "awaiting_approval" | "active" | "paused";
  firstRunPreview: string | null;
  lastRunAt: string | null;
}

interface BiToken {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function reportTypeLabel(type: ScheduledReport["reportType"], lang: Lang): string {
  switch (type) {
    case "weekly_summary": return tri(lang, "خلاصه هفتگی", "Weekly summary", "Wöchentliche Zusammenfassung");
    case "monthly_pl": return tri(lang, "سود و زیان ماهانه", "Monthly profit & loss", "Monatliche Gewinn- und Verlustrechnung");
    default: return tri(lang, "مالیات بر ارزش‌افزوده ماهانه", "Monthly VAT", "Monatliche Umsatzsteuer");
  }
}

const STATUS_STYLE: Record<ScheduledReport["status"], { color: string; bg: string }> = {
  pending_first_approval: { color: "var(--text-secondary)", bg: "var(--surface-2)" },
  awaiting_approval: { color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  active: { color: "var(--pos)", bg: "rgba(27,175,122,0.12)" },
  paused: { color: "var(--text-muted)", bg: "var(--surface-2)" },
};

function scheduleStatusLabel(status: ScheduledReport["status"], lang: Lang): string {
  switch (status) {
    case "pending_first_approval": return tri(lang, "در انتظار اولین اجرا", "Waiting for the first run", "Wartet auf den ersten Lauf");
    case "awaiting_approval": return tri(lang, "منتظر تأیید شما", "Awaiting your approval", "Wartet auf Ihre Freigabe");
    case "active": return tri(lang, "فعال", "Active", "Aktiv");
    default: return tri(lang, "متوقف‌شده", "Paused", "Pausiert");
  }
}

export default function AccountingAutomationPage() {
  const { lang, dir, fmtNum: fmt, fmtDate } = useAccountingLocale();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [tokens, setTokens] = useState<BiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ScheduledReport["reportType"]>("monthly_pl");
  const [frequency, setFrequency] = useState<ScheduledReport["frequency"]>("monthly");
  const [email, setEmail] = useState("");
  // Report language and report currency are independent of each other AND of
  // the UI language: a Persian admin can schedule an English report in EUR for
  // an overseas owner. The backend already stored `lang`; the form never sent
  // it, so in practice every report came out in the default language.
  const [reportLang, setReportLang] = useState<Lang>(lang);
  const [reportCurrency, setReportCurrency] = useState("");

  const [tokenLabel, setTokenLabel] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [repRes, tokRes] = await Promise.all([
      fetch("/api/accounting/scheduled-reports", { credentials: "include" }),
      fetch("/api/accounting/bi-tokens", { credentials: "include" }),
    ]);
    const repJson = await repRes.json();
    const tokJson = await tokRes.json();
    if (repRes.ok) setReports(repJson.reports);
    if (tokRes.ok) setTokens(tokJson.tokens);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createReport() {
    if (!email.trim()) return toast.error(tri(lang, "ایمیل گیرنده را وارد کنید", "Enter the recipient email", "Empfänger-E-Mail eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/scheduled-reports", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, frequency, recipientEmail: email, lang: reportLang, currency: reportCurrency || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "زمان‌بندی ساخته شد — اولین اجرا فقط پیش‌نمایش می‌سازد و منتظر تأیید شما می‌ماند", "Schedule created — the first run only builds a preview and waits for your approval", "Zeitplan erstellt — der erste Lauf erzeugt nur eine Vorschau und wartet auf Ihre Freigabe"));
      setEmail("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ساخت زمان‌بندی", "Failed to create the schedule", "Zeitplan konnte nicht erstellt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function reportAction(id: string, action: "approve-first-run" | "pause" | "resume") {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/scheduled-reports/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(action === "approve-first-run" ? tri(lang, "ایمیل ارسال شد و ارسال خودکار دائمی فعال شد", "Email sent and automatic delivery is now permanently on", "E-Mail gesendet und automatischer Versand dauerhaft aktiviert") : tri(lang, "انجام شد", "Done", "Erledigt"));
      setPreviewOpen(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport(id: string) {
    if (!confirm(tri(lang, "این زمان‌بندی حذف شود؟", "Delete this schedule?", "Diesen Zeitplan löschen?"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/scheduled-reports/${id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در حذف", "Failed to delete", "Löschen fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    if (!tokenLabel.trim()) return toast.error(tri(lang, "برچسب توکن را وارد کنید", "Enter a token label", "Token-Bezeichnung eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/bi-tokens", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: tokenLabel }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFreshToken(j.token);
      setTokenLabel("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ساخت توکن", "Failed to create the token", "Token konnte nicht erstellt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm(tri(lang, "این توکن ابطال شود؟ هر ابزاری که با آن متصل است بلافاصله قطع می‌شود.", "Revoke this token? Any tool connected with it is disconnected immediately.", "Diesen Token widerrufen? Jedes damit verbundene Tool wird sofort getrennt."))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/bi-tokens/${id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ابطال توکن", "Failed to revoke the token", "Token konnte nicht widerrufen werden"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <AccountingNav />
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "گزارش‌های زمان‌بندی‌شده و API خروجی BI", "Scheduled reports & BI export API", "Geplante Berichte & BI-Export-API")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "ارسال خودکار گزارش‌های مالی و اتصال ابزارهای تحلیل خارجی", "Automatic financial report delivery and external analytics connections", "Automatischer Versand von Finanzberichten und Anbindung externer Analysetools")}</p>
        </div>
      </div>

      {/* Scheduled reports */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "گزارش‌های زمان‌بندی‌شده", "Scheduled reports", "Geplante Berichte")}</h2>

        <div className="space-y-3 mb-4">
          {reports.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز زمان‌بندی‌ای ساخته نشده", "No schedules created yet", "Noch keine Zeitpläne erstellt")}</p>
          ) : reports.map((r) => {
            const st = STATUS_STYLE[r.status];
            const preview = r.firstRunPreview ? (JSON.parse(r.firstRunPreview) as { subject: string; html: string }) : null;
            return (
              <div key={r.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{reportTypeLabel(r.reportType, lang)} — {r.frequency === "weekly" ? tri(lang, "هفتگی", "Weekly", "Wöchentlich") : tri(lang, "ماهانه", "Monthly", "Monatlich")}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "گیرنده:", "Recipient:", "Empfänger:")} {r.recipientEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{scheduleStatusLabel(r.status, lang)}</span>
                    {r.status === "awaiting_approval" && preview && (
                      <button onClick={() => setPreviewOpen(previewOpen === r.id ? null : r.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title={tri(lang, "نمایش پیش‌نمایش", "Show preview", "Vorschau anzeigen")}><Eye className="w-4 h-4" /></button>
                    )}
                    {r.status === "active" && (
                      <button disabled={busy} onClick={() => reportAction(r.id, "pause")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title={tri(lang, tri(lang, "توقف", "Pause", "Pausieren"), "Pause", "Pausieren")}><Pause className="w-4 h-4" /></button>
                    )}
                    {r.status === "paused" && (
                      <button disabled={busy} onClick={() => reportAction(r.id, "resume")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title={tri(lang, tri(lang, "از سرگیری", "Resume", "Fortsetzen"), "Resume", "Fortsetzen")}><Play className="w-4 h-4" /></button>
                    )}
                    <button disabled={busy} onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--neg)" }} title={tri(lang, tri(lang, "حذف", "Delete", "Löschen"), "Delete", "Löschen")}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {r.status === "awaiting_approval" && previewOpen === r.id && preview && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "این پیش‌نمایش دقیقاً همان محتوایی است که با تأیید شما ارسال می‌شود — بعد از آن، ارسال خودکار دائمی فعال خواهد شد.", "This preview is exactly what will be sent once you approve it — after that, automatic delivery stays on permanently.", "Diese Vorschau entspricht genau dem, was nach Ihrer Freigabe gesendet wird — danach bleibt der automatische Versand dauerhaft aktiv.")}</p>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "موضوع:", "Subject:", "Betreff:")} {preview.subject}</div>
                    <div className="text-xs max-h-64 overflow-auto p-2 rounded-md" style={{ background: "var(--surface-2)" }} dangerouslySetInnerHTML={{ __html: preview.html }} />
                    <button disabled={busy} onClick={() => reportAction(r.id, "approve-first-run")} className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                      <Send className="w-4 h-4" />{tri(lang, "تأیید و ارسال — فعال‌سازی ارسال خودکار دائمی", "Approve & send — turn on permanent automatic delivery", "Freigeben & senden — dauerhaften automatischen Versand aktivieren")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ScheduledReport["reportType"])} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="monthly_pl">{tri(lang, "سود و زیان ماهانه", "Monthly profit & loss", "Monatliche Gewinn- und Verlustrechnung")}</option>
            <option value="weekly_summary">{tri(lang, "خلاصه هفتگی", "Weekly summary", "Wöchentliche Zusammenfassung")}</option>
            <option value="monthly_vat">{tri(lang, "مالیات بر ارزش‌افزوده ماهانه", "Monthly VAT", "Monatliche Umsatzsteuer")}</option>
          </select>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduledReport["frequency"])} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="monthly">{tri(lang, "ماهانه", "Monthly", "Monatlich")}</option>
            <option value="weekly">{tri(lang, "هفتگی", "Weekly", "Wöchentlich")}</option>
          </select>
          <select value={reportLang} onChange={(e) => setReportLang(e.target.value as Lang)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="fa">{tri(lang, "گزارش به فارسی", "Report in Persian", "Bericht auf Persisch")}</option>
            <option value="en">{tri(lang, "گزارش به انگلیسی", "Report in English", "Bericht auf Englisch")}</option>
            <option value="de">{tri(lang, "گزارش به آلمانی", "Report in German", "Bericht auf Deutsch")}</option>
          </select>
          <select value={reportCurrency} onChange={(e) => setReportCurrency(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "بدون تبدیل ارز", "No currency conversion", "Keine Währungsumrechnung")}</option>
            {REPORT_CURRENCIES.map((c) => (
              <option key={c} value={c}>{tri(lang, `همچنین به ${c}`, `Also show in ${c}`, `Zusätzlich in ${c}`)}</option>
            ))}
          </select>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tri(lang, "ایمیل گیرنده", "Recipient email", "Empfänger-E-Mail")} type="email" className="flex-1 min-w-[180px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={createReport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "ساخت زمان‌بندی", "Create schedule", "Zeitplan erstellen")}
          </button>
        </div>
      </div>

      {/* BI tokens */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><KeyRound className="w-4 h-4" />{tri(lang, "توکن‌های API برای اتصال BI خارجی", "API tokens for external BI connections", "API-Token für externe BI-Anbindungen")}</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{tri(lang, "فقط‌خواندنی — یک ابزار BI خارجی می‌تواند با این توکن گزارش‌های تجمیعی را بخواند، هرگز چیزی ننویسد.", "Read-only — an external BI tool can read aggregated reports with this token, never write anything.", "Nur Lesezugriff — ein externes BI-Tool kann damit aggregierte Berichte lesen, aber nichts schreiben.")}</p>

        {/* This used to just describe the concept and hand over a token with
            no address to send it to — a non-developer had a secret and
            nothing to do with it. Now the actual address a tool like Power
            BI or Excel needs is spelled out, in the form those tools expect. */}
        <div className="rounded-lg p-3 mb-3 text-xs space-y-1.5" style={{ background: "var(--surface-2)" }}>
          <p style={{ color: "var(--text-secondary)" }}>{tri(lang, "برای اتصال:", "To connect:", "So verbinden Sie:")}</p>
          <p style={{ color: "var(--text-muted)" }}>
            1. {tri(lang, "یک توکن بسازید (پایین همین بخش)", "Create a token (bottom of this section)", "Erstellen Sie einen Token (unten in diesem Abschnitt)")}
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            2. {tri(lang, "این آدرس را در ابزار BI خود (مثلاً Power BI → Get Data → Web) وارد کنید:",
              "Enter this address in your BI tool (e.g. Power BI → Get Data → Web):",
              "Geben Sie diese Adresse in Ihrem BI-Tool ein (z. B. Power BI → Daten abrufen → Web):")}
          </p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 px-2 py-1.5 rounded-md break-all" style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}>
              {typeof window !== "undefined" ? window.location.origin : "https://aifekr.com"}/api/bi/accounting?from=2026-01-01&amp;to=2026-01-31
            </code>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/bi/accounting?from=2026-01-01&to=2026-01-31`); toast.success(tri(lang, "کپی شد", "Copied", "Kopiert")); }} className="p-1.5 rounded-lg flex-shrink-0" style={{ background: "var(--surface-1)" }}><Copy className="w-4 h-4" /></button>
          </div>
          <p style={{ color: "var(--text-muted)" }}>
            3. {tri(lang, "با هدر HTTP زیر (توکن خودتان را جای TOKEN بگذارید):",
              "With this HTTP header (put your own token where it says TOKEN):",
              "Mit diesem HTTP-Header (setzen Sie Ihren eigenen Token anstelle von TOKEN ein):")}
          </p>
          <code dir="ltr" className="block px-2 py-1.5 rounded-md" style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}>
            Authorization: Bearer TOKEN
          </code>
          <p style={{ color: "var(--text-muted)" }}>
            {tri(lang, "پاسخ JSON است — یک جدول از تراکنش‌های دفتر کل در بازه انتخاب‌شده. تاریخ‌ها (from/to) در آدرس قابل تغییرند.",
              "The response is JSON — a table of ledger transactions for the selected period. The from/to dates in the address can be changed.",
              "Die Antwort ist JSON — eine Tabelle der Hauptbuchtransaktionen für den gewählten Zeitraum. Die from/to-Daten in der Adresse können geändert werden.")}
          </p>
        </div>

        {freshToken && (
          <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: "rgba(237,161,0,0.1)", border: "1px solid rgba(237,161,0,0.3)" }}>
            <p className="mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "این توکن فقط همین یک‌بار نمایش داده می‌شود — همین حالا ذخیره کنید:", "This token is shown only once — save it now:", "Dieser Token wird nur einmal angezeigt — speichern Sie ihn jetzt:")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 rounded-md break-all" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{freshToken}</code>
              <button onClick={() => { navigator.clipboard.writeText(freshToken); toast.success(tri(lang, "کپی شد", "Copied", "Kopiert")); }} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)" }}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {tokens.filter((t) => !t.revokedAt).length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "توکن فعالی وجود ندارد", "No active tokens", "Keine aktiven Token")}</p>
          ) : tokens.filter((t) => !t.revokedAt).map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <span style={{ color: "var(--text-primary)" }}>{t.label}</span>
                <span className="text-xs ms-2" style={{ color: "var(--text-muted)" }}>{t.lastUsedAt ? `${tri(lang, "آخرین استفاده", "Last used", "Zuletzt verwendet")}: ${new Date(t.lastUsedAt).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US")}` : tri(lang, "هنوز استفاده نشده", "Not used yet", "Noch nicht verwendet")}</span>
              </div>
              <button disabled={busy} onClick={() => revokeToken(t.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--neg)" }}>{tri(lang, "ابطال", "Revoke", "Widerrufen")}</button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} placeholder={tri(lang, tri(lang, "برچسب توکن (مثلاً Power BI)", "Token label (e.g. Power BI)", "Token-Bezeichnung (z. B. Power BI)"), "Token label (e.g. Power BI)", "Token-Bezeichnung (z. B. Power BI)")} className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={createToken} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Plus className="w-4 h-4" />{tri(lang, "ساخت توکن جدید", "Create new token", "Neuen Token erstellen")}
          </button>
        </div>
      </div>
    </div>
  );
}
