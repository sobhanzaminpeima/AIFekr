"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, ShieldCheck, Lock, Unlock, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";

interface FiscalPeriod {
  id: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
}

interface AuditFinding {
  category: string;
  count: number;
  detail: string;
}

interface AuditReport {
  from: string;
  to: string;
  ledgerBalanced: boolean;
  findings: AuditFinding[];
  readyToClose: boolean;
}


export default function ClosePeriodPage() {
  const { lang, dir, fmtNum: fmt, fmtDate, fmtMonth: monthLabel } = useAccountingLocale();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  // "no periods yet" and "still fetching" are different answers -- showing the
  // former while the request is in flight reads as a wrong empty state.
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Record<string, AuditReport>>({});
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/fiscal-periods", { credentials: "include" });
    const j = await res.json();
    if (res.ok) setPeriods(j.periods);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createPeriod() {
    if (!start || !end) return toast.error(tri(lang, "تاریخ شروع و پایان را وارد کنید", "Enter a start and end date", "Start- und Enddatum eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/fiscal-periods", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "دوره مالی ساخته شد", "Fiscal period created", "Geschäftsperiode erstellt"));
      setStart(""); setEnd("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ساخت دوره مالی", "Failed to create the fiscal period", "Geschäftsperiode konnte nicht erstellt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function runAudit(period: FiscalPeriod) {
    setChecking(period.id);
    try {
      const res = await fetch("/api/accounting/ai/audit-copilot", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: period.startDate, to: period.endDate }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setReports((prev) => ({ ...prev, [period.id]: j.report }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در بررسی", "Check failed", "Prüfung fehlgeschlagen"));
    } finally {
      setChecking(null);
    }
  }

  async function periodAction(id: string, action: "close" | "reopen") {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/fiscal-periods/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(action === "close" ? tri(lang, "دوره بسته شد", "Period closed", "Periode abgeschlossen") : tri(lang, "دوره بازگشایی شد", "Period reopened", "Periode wieder geöffnet"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "دوره‌های مالی و بستن حساب‌ها", "Fiscal periods & closing", "Geschäftsperioden & Abschluss")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "قبل از بستن هر دوره، Audit Copilot را اجرا کنید تا موارد باز شناسایی شوند", "Run Audit Copilot before closing a period so open items get surfaced", "Führen Sie den Audit-Copiloten vor dem Periodenabschluss aus, um offene Posten zu finden")}</p>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "ساخت دوره مالی جدید", "Create a new fiscal period", "Neue Geschäftsperiode erstellen")}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <span style={{ color: "var(--text-muted)" }}>{tri(lang, "تا", "to", "bis")}</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={createPeriod} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus className="w-4 h-4" />{tri(lang, "ساخت دوره", "Create period", "Periode erstellen")}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>
        ) : periods.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{tri(lang, "هنوز دوره مالی‌ای ساخته نشده", "No fiscal periods created yet", "Noch keine Geschäftsperioden erstellt")}</div>
        ) : periods.map((p) => {
          const report = reports[p.id];
          return (
            <div key={p.id} className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmtDate(p.startDate)} {tri(lang, "تا", "to", "bis")} {fmtDate(p.endDate)}</span>
                  {p.isLocked ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(27,175,122,0.12)", color: "#1baf7a" }}><Lock className="w-3 h-3" />{tri(lang, "بسته‌شده", "Closed", "Abgeschlossen")}</span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{tri(lang, "باز", "Open", "Offen")}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!p.isLocked && (
                    <button disabled={checking === p.id} onClick={() => runAudit(p)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      <ShieldCheck className="w-3.5 h-3.5" />{checking === p.id ? tri(lang, "در حال بررسی...", "Checking…", "Wird geprüft…") : tri(lang, "اجرای Audit Copilot", "Run Audit Copilot", "Audit-Copilot ausführen")}
                    </button>
                  )}
                  {!p.isLocked && (
                    <button disabled={busy} onClick={() => periodAction(p.id, "close")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                      <Lock className="w-3.5 h-3.5" />{tri(lang, "بستن دوره", "Close period", "Periode abschließen")}
                    </button>
                  )}
                  {p.isLocked && (
                    <button disabled={busy} onClick={() => periodAction(p.id, "reopen")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "var(--surface-2)", color: "#e34948", border: "1px solid var(--border)" }}>
                      <Unlock className="w-3.5 h-3.5" />{tri(lang, "باز", "Open", "Offen")}گشایی
                    </button>
                  )}
                </div>
              </div>

              {report && (
                <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                  {report.readyToClose ? (
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: "#1baf7a" }}><CheckCircle2 className="w-4 h-4" />{tri(lang, "همه چیز تمیز است — این دوره آماده بستن است", "Everything is clean — this period is ready to close", "Alles sauber — diese Periode kann abgeschlossen werden")}</div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#eda100" }}><AlertTriangle className="w-4 h-4" />{report.findings.length} {tri(lang, "مورد باز پیدا شد", "open items found", "offene Posten gefunden")}</div>
                      {report.findings.map((f, i) => (
                        <div key={i} className="text-xs pe-5" style={{ color: "var(--text-secondary)" }}>• {f.detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
