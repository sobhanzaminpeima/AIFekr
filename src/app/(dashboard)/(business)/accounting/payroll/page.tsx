"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, UserPlus, Play, CheckCircle2, Wallet, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { useCompanyLogo } from "@/lib/hooks/useCompanyLogo";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";

interface Employee {
  id: string;
  name: string;
  userId: string | null;
  baseSalary: number;
  isActive: boolean;
}

interface Payslip {
  id: string;
  employeeId: string;
  baseSalary: number;
  commissionTotal: number;
  bonus: number;
  deductions: number;
  netPay: number;
  employee: Employee;
}

interface PayrollRun {
  id: string;
  period: string;
  status: "draft" | "approved" | "paid";
  payslips: Payslip[];
}

const STATUS_STYLE: Record<PayrollRun["status"], { color: string; bg: string }> = {
  draft: { color: "var(--text-secondary)", bg: "var(--surface-2)" },
  approved: { color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  paid: { color: "#1baf7a", bg: "rgba(27,175,122,0.12)" },
};

function statusLabel(status: PayrollRun["status"], lang: Lang): string {
  switch (status) {
    case "draft": return tri(lang, "پیش‌نویس", "Draft", "Entwurf");
    case "approved": return tri(lang, "تأییدشده", "Approved", "Genehmigt");
    default: return tri(lang, "پرداخت‌شده", "Paid", "Bezahlt");
  }
}

export default function PayrollPage() {
  const { lang, dir, fmtNum: fmt, fmtMonth: monthLabel } = useAccountingLocale();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printSlip, setPrintSlip] = useState<{ payslip: Payslip; period: string } | null>(null);

  const load = useCallback(async () => {
    const [empRes, runRes] = await Promise.all([
      fetch("/api/accounting/employees", { credentials: "include" }),
      fetch("/api/accounting/payroll-runs", { credentials: "include" }),
    ]);
    const empJson = await empRes.json();
    const runJson = await runRes.json();
    if (empRes.ok) setEmployees(empJson.employees);
    if (runRes.ok) setRuns(runJson.runs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addEmployee() {
    if (!newName.trim()) return toast.error(tri(lang, "نام کارمند را وارد کنید", "Enter the employee name", "Mitarbeiternamen eingeben"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/employees", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, baseSalary: Number(newSalary) || 0 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "کارمند اضافه شد", "Employee added", "Mitarbeiter hinzugefügt"));
      setNewName(""); setNewSalary("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در افزودن کارمند", "Failed to add the employee", "Mitarbeiter konnte nicht hinzugefügt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function generateRun() {
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/payroll-runs", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: `${period}-01` }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "لیست حقوق ساخته شد", "Payroll run created", "Gehaltslauf erstellt"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ساخت لیست حقوق", "Failed to create the payroll run", "Gehaltslauf konnte nicht erstellt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function updatePayslip(id: string, bonus: number, deductions: number) {
    try {
      const res = await fetch(`/api/accounting/payslips/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonus, deductions }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در به‌روزرسانی فیش", "Failed to update the payslip", "Gehaltsabrechnung konnte nicht aktualisiert werden"));
    }
  }

  async function runAction(runId: string, action: "approve" | "pay") {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/payroll-runs/${runId}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(action === "approve" ? tri(lang, "لیست حقوق تأیید شد", "Payroll run approved", "Gehaltslauf genehmigt") : tri(lang, "پرداخت ثبت شد", "Payment recorded", "Zahlung erfasst"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "حقوق و دستمزد", "Payroll", "Gehaltsabrechnung")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "حقوق پایه، کمیسیون واقعی، پاداش و کسورات", "Base salary, actual commission, bonuses and deductions", "Grundgehalt, tatsächliche Provision, Boni und Abzüge")}</p>
        </div>
      </div>

      {/* Employees */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "کارمندان", "Employees", "Mitarbeiter")}</h2>
        <div className="space-y-2 mb-4">
          {employees.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز کارمندی ثبت نشده", "No employees added yet", "Noch keine Mitarbeiter erfasst")}</p>
          ) : employees.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{e.name}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "حقوق پایه", "Base salary", "Grundgehalt")}: {fmt(e.baseSalary)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tri(lang, tri(lang, "نام کارمند", "Employee name", "Mitarbeitername"), "Employee name", "Mitarbeitername")} className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder={tri(lang, tri(lang, "حقوق پایه (تومان)", "Base salary (Toman)", "Grundgehalt (Toman)"), "Base salary (Toman)", "Grundgehalt (Toman)")} type="number" className="w-40 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addEmployee} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <UserPlus className="w-4 h-4" />{tri(lang, "افزودن", "Add", "Hinzufügen")}
          </button>
        </div>
      </div>

      {/* Generate run */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "ساخت لیست حقوق ماهانه", "Create monthly payroll run", "Monatliche Gehaltsabrechnung erstellen")}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={generateRun} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Play className="w-4 h-4" />{tri(lang, "تولید / بازتولید لیست حقوق این ماه", "Generate / regenerate this month's payroll", "Gehaltslauf dieses Monats erstellen / neu erstellen")}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "کمیسیون هر کارمند مستقیماً از رکوردهای کمیسیون پرداخت‌شدهٔ دفتر کل محاسبه می‌شود.", "Each employee's commission is computed directly from paid commission records in the ledger.", "Die Provision jedes Mitarbeiters wird direkt aus den bezahlten Provisionsbuchungen im Hauptbuch berechnet.")}</p>
      </div>

      {/* Runs */}
      <div className="space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{tri(lang, "هنوز لیست حقوقی ساخته نشده", "No payroll runs created yet", "Noch keine Gehaltsläufe erstellt")}</div>
        ) : runs.map((run) => {
          const total = run.payslips.reduce((s, p) => s + p.netPay, 0);
          const st = STATUS_STYLE[run.status];
          const expanded = expandedRun === run.id;
          return (
            <div key={run.id} className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <button className="w-full flex items-center justify-between" onClick={() => setExpandedRun(expanded ? null : run.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{monthLabel(run.period)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{statusLabel(run.status, lang)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(total)} {tri(lang, "تومان", "Toman", "Toman")}</span>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {expanded && (
                <div className="mt-4 space-y-3">
                  {run.payslips.map((p) => (
                    <PayslipRow key={p.id} payslip={p} editable={run.status === "draft"} onSave={updatePayslip} onPrint={() => setPrintSlip({ payslip: p, period: run.period })} />
                  ))}
                  <div className="flex gap-2 pt-2">
                    {run.status === "draft" && (
                      <button disabled={busy} onClick={() => runAction(run.id, "approve")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                        <CheckCircle2 className="w-4 h-4" />{tri(lang, "تأیید لیست حقوق", "Approve payroll run", "Gehaltslauf genehmigen")}
                      </button>
                    )}
                    {run.status === "approved" && (
                      <button disabled={busy} onClick={() => runAction(run.id, "pay")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#1baf7a", color: "#fff" }}>
                        <Wallet className="w-4 h-4" />{tri(lang, "ثبت پرداخت", "Record payment", "Zahlung erfassen")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {printSlip && <PayslipPrintModal payslip={printSlip.payslip} period={printSlip.period} onClose={() => setPrintSlip(null)} />}
    </div>
  );
}

function PayslipPrintModal({ payslip, period, onClose }: { payslip: Payslip; period: string; onClose: () => void }) {
  const { lang, dir, fmtNum: fmt, fmtMonth: monthLabel } = useAccountingLocale();
  const logoUrl = useCompanyLogo();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{tri(lang, "چاپ / ذخیره PDF", "Print / Save PDF", "Drucken / Als PDF speichern")}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{tri(lang, "بستن", "Close", "Schließen")}</button>
      </div>
      <div dir={dir} className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none" style={{ background: "#fff", color: "#111" }}>
        {logoUrl && <img src={logoUrl} alt="logo" className="h-10 object-contain" style={{ maxWidth: 160 }} />}
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold">{tri(lang, "فیش حقوقی", "Payslip", "Gehaltsabrechnung")}</h2>
          <span className="text-xs">{monthLabel(period)}</span>
        </div>
        <div className="text-sm font-medium">{payslip.employee.name}</div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "حقوق پایه", "Base salary", "Grundgehalt")}</td><td className="py-2 text-left">{fmt(payslip.baseSalary)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "کمیسیون", "Commission", "Provision")}</td><td className="py-2 text-left">{fmt(payslip.commissionTotal)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "پاداش", "Bonus", "Bonus")}</td><td className="py-2 text-left">{fmt(payslip.bonus)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "کسورات", "Deductions", "Abzüge")}</td><td className="py-2 text-left">-{fmt(payslip.deductions)}</td></tr>
            <tr><td className="py-2 font-bold">{tri(lang, "خالص قابل‌پرداخت", "Net pay", "Nettoauszahlung")}</td><td className="py-2 text-left font-bold">{fmt(payslip.netPay)} تومان</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayslipRow({ payslip, editable, onSave, onPrint }: { payslip: Payslip; editable: boolean; onSave: (id: string, bonus: number, deductions: number) => void; onPrint: () => void }) {
  const { lang, fmtNum: fmt } = useAccountingLocale();
  const [bonus, setBonus] = useState(String(payslip.bonus));
  const [deductions, setDeductions] = useState(String(payslip.deductions));

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{payslip.employee.name}</span>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-primary)" }}>{tri(lang, "خالص", "Net", "Netto")}: {fmt(payslip.netPay)}</span>
          <button onClick={onPrint} className="p-1 rounded-md" style={{ color: "var(--text-secondary)" }} title={tri(lang, tri(lang, "چاپ فیش حقوقی", "Print payslip", "Gehaltsabrechnung drucken"), "Print payslip", "Gehaltsabrechnung drucken")}><Printer className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div>{tri(lang, "پایه", "Base", "Grund")}: {fmt(payslip.baseSalary)}</div>
        <div>{tri(lang, "کمیسیون", "Commission", "Provision")}: {fmt(payslip.commissionTotal)}</div>
        {editable ? (
          <>
            <label className="flex flex-col gap-1">
              <span>{tri(lang, "پاداش", "Bonus", "Bonus")}</span>
              <input value={bonus} onChange={(e) => setBonus(e.target.value)} onBlur={() => onSave(payslip.id, Number(bonus) || 0, Number(deductions) || 0)} type="number" className="px-2 py-1 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{tri(lang, "کسورات", "Deductions", "Abzüge")}</span>
              <input value={deductions} onChange={(e) => setDeductions(e.target.value)} onBlur={() => onSave(payslip.id, Number(bonus) || 0, Number(deductions) || 0)} type="number" className="px-2 py-1 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </label>
          </>
        ) : (
          <>
            <div>{tri(lang, "پاداش", "Bonus", "Bonus")}: {fmt(payslip.bonus)}</div>
            <div>{tri(lang, "کسورات", "Deductions", "Abzüge")}: {fmt(payslip.deductions)}</div>
          </>
        )}
      </div>
    </div>
  );
}
