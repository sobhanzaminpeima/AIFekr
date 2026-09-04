"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Send, Pause, Play, Trash2, Eye, KeyRound, Copy, Plus } from "lucide-react";

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

const REPORT_TYPE_LABEL: Record<ScheduledReport["reportType"], string> = {
  weekly_summary: "خلاصه هفتگی",
  monthly_pl: "سود و زیان ماهانه",
  monthly_vat: "مالیات بر ارزش‌افزوده ماهانه",
};

const STATUS_LABEL: Record<ScheduledReport["status"], { text: string; color: string; bg: string }> = {
  pending_first_approval: { text: "در انتظار اولین اجرا", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  awaiting_approval: { text: "منتظر تأیید شما", color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  active: { text: "فعال", color: "#1baf7a", bg: "rgba(27,175,122,0.12)" },
  paused: { text: "متوقف‌شده", color: "var(--text-muted)", bg: "var(--surface-2)" },
};

export default function AccountingAutomationPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [tokens, setTokens] = useState<BiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ScheduledReport["reportType"]>("monthly_pl");
  const [frequency, setFrequency] = useState<ScheduledReport["frequency"]>("monthly");
  const [email, setEmail] = useState("");

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
    if (!email.trim()) return toast.error("ایمیل گیرنده را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/scheduled-reports", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, frequency, recipientEmail: email }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("زمان‌بندی ساخته شد — اولین اجرا فقط پیش‌نمایش می‌سازد و منتظر تأیید شما می‌ماند");
      setEmail("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت زمان‌بندی");
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
      toast.success(action === "approve-first-run" ? "ایمیل ارسال شد و ارسال خودکار دائمی فعال شد" : "انجام شد");
      setPreviewOpen(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport(id: string) {
    if (!confirm("این زمان‌بندی حذف شود؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/scheduled-reports/${id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف");
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    if (!tokenLabel.trim()) return toast.error("برچسب توکن را وارد کنید");
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
      toast.error(e instanceof Error ? e.message : "خطا در ساخت توکن");
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm("این توکن ابطال شود؟ هر ابزاری که با آن متصل است بلافاصله قطع می‌شود.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/bi-tokens/${id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ابطال توکن");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>گزارش‌های زمان‌بندی‌شده و API خروجی BI</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>ارسال خودکار گزارش‌های مالی و اتصال ابزارهای تحلیل خارجی</p>
        </div>
      </div>

      {/* Scheduled reports */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>گزارش‌های زمان‌بندی‌شده</h2>

        <div className="space-y-3 mb-4">
          {reports.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>هنوز زمان‌بندی‌ای ساخته نشده</p>
          ) : reports.map((r) => {
            const st = STATUS_LABEL[r.status];
            const preview = r.firstRunPreview ? (JSON.parse(r.firstRunPreview) as { subject: string; html: string }) : null;
            return (
              <div key={r.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{REPORT_TYPE_LABEL[r.reportType]} — {r.frequency === "weekly" ? "هفتگی" : "ماهانه"}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>گیرنده: {r.recipientEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                    {r.status === "awaiting_approval" && preview && (
                      <button onClick={() => setPreviewOpen(previewOpen === r.id ? null : r.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title="نمایش پیش‌نمایش"><Eye className="w-4 h-4" /></button>
                    )}
                    {r.status === "active" && (
                      <button disabled={busy} onClick={() => reportAction(r.id, "pause")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title="توقف"><Pause className="w-4 h-4" /></button>
                    )}
                    {r.status === "paused" && (
                      <button disabled={busy} onClick={() => reportAction(r.id, "resume")} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }} title="از سرگیری"><Play className="w-4 h-4" /></button>
                    )}
                    <button disabled={busy} onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-1)", color: "#e34948" }} title="حذف"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {r.status === "awaiting_approval" && previewOpen === r.id && preview && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>این پیش‌نمایش دقیقاً همان محتوایی است که با تأیید شما ارسال می‌شود — بعد از آن، ارسال خودکار دائمی فعال خواهد شد.</p>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>موضوع: {preview.subject}</div>
                    <div className="text-xs max-h-64 overflow-auto p-2 rounded-md" style={{ background: "var(--surface-2)" }} dangerouslySetInnerHTML={{ __html: preview.html }} />
                    <button disabled={busy} onClick={() => reportAction(r.id, "approve-first-run")} className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                      <Send className="w-4 h-4" />تأیید و ارسال — فعال‌سازی ارسال خودکار دائمی
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ScheduledReport["reportType"])} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="monthly_pl">سود و زیان ماهانه</option>
            <option value="weekly_summary">خلاصه هفتگی</option>
            <option value="monthly_vat">مالیات بر ارزش‌افزوده ماهانه</option>
          </select>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduledReport["frequency"])} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="monthly">ماهانه</option>
            <option value="weekly">هفتگی</option>
          </select>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل گیرنده" type="email" className="flex-1 min-w-[180px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={createReport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />ساخت زمان‌بندی
          </button>
        </div>
      </div>

      {/* BI tokens */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><KeyRound className="w-4 h-4" />توکن‌های API برای اتصال BI خارجی</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>فقط‌خواندنی — یک ابزار BI خارجی می‌تواند با این توکن گزارش‌های تجمیعی را بخواند، هرگز چیزی ننویسد.</p>

        {freshToken && (
          <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: "rgba(237,161,0,0.1)", border: "1px solid rgba(237,161,0,0.3)" }}>
            <p className="mb-2" style={{ color: "var(--text-primary)" }}>این توکن فقط همین یک‌بار نمایش داده می‌شود — همین حالا ذخیره کنید:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 rounded-md break-all" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{freshToken}</code>
              <button onClick={() => { navigator.clipboard.writeText(freshToken); toast.success("کپی شد"); }} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)" }}><Copy className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          {tokens.filter((t) => !t.revokedAt).length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>توکن فعالی وجود ندارد</p>
          ) : tokens.filter((t) => !t.revokedAt).map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <span style={{ color: "var(--text-primary)" }}>{t.label}</span>
                <span className="text-xs mr-2" style={{ color: "var(--text-muted)" }}>{t.lastUsedAt ? `آخرین استفاده: ${new Date(t.lastUsedAt).toLocaleDateString("fa-IR")}` : "هنوز استفاده نشده"}</span>
              </div>
              <button disabled={busy} onClick={() => revokeToken(t.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "#e34948" }}>ابطال</button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} placeholder="برچسب توکن (مثلاً Power BI)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={createToken} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Plus className="w-4 h-4" />ساخت توکن جدید
          </button>
        </div>
      </div>
    </div>
  );
}
