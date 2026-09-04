"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, UserPlus, Play, CheckCircle2, Wallet, ChevronDown, ChevronUp, Printer } from "lucide-react";

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

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long" });
}

const STATUS_LABEL: Record<PayrollRun["status"], { text: string; color: string; bg: string }> = {
  draft: { text: "پیش‌نویس", color: "var(--text-secondary)", bg: "var(--surface-2)" },
  approved: { text: "تأییدشده", color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  paid: { text: "پرداخت‌شده", color: "#1baf7a", bg: "rgba(27,175,122,0.12)" },
};

export default function PayrollPage() {
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
    if (!newName.trim()) return toast.error("نام کارمند را وارد کنید");
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/employees", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, baseSalary: Number(newSalary) || 0 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("کارمند اضافه شد");
      setNewName(""); setNewSalary("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در افزودن کارمند");
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
      toast.success("لیست حقوق ساخته شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت لیست حقوق");
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
      toast.error(e instanceof Error ? e.message : "خطا در به‌روزرسانی فیش");
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
      toast.success(action === "approve" ? "لیست حقوق تأیید شد" : "پرداخت ثبت شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
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
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>حقوق و دستمزد</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>حقوق پایه، کمیسیون واقعی، پاداش و کسورات</p>
        </div>
      </div>

      {/* Employees */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>کارمندان</h2>
        <div className="space-y-2 mb-4">
          {employees.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>هنوز کارمندی ثبت نشده</p>
          ) : employees.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>{e.name}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>حقوق پایه: {fmt(e.baseSalary)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="نام کارمند" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="حقوق پایه (تومان)" type="number" className="w-40 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={addEmployee} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
            <UserPlus className="w-4 h-4" />افزودن
          </button>
        </div>
      </div>

      {/* Generate run */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>ساخت لیست حقوق ماهانه</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button disabled={busy} onClick={generateRun} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Play className="w-4 h-4" />تولید / بازتولید لیست حقوق این ماه
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>کمیسیون هر کارمند مستقیماً از رکوردهای کمیسیون پرداخت‌شدهٔ دفتر کل محاسبه می‌شود.</p>
      </div>

      {/* Runs */}
      <div className="space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>هنوز لیست حقوقی ساخته نشده</div>
        ) : runs.map((run) => {
          const total = run.payslips.reduce((s, p) => s + p.netPay, 0);
          const st = STATUS_LABEL[run.status];
          const expanded = expandedRun === run.id;
          return (
            <div key={run.id} className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <button className="w-full flex items-center justify-between" onClick={() => setExpandedRun(expanded ? null : run.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{monthLabel(run.period)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(total)} تومان</span>
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
                        <CheckCircle2 className="w-4 h-4" />تأیید لیست حقوق
                      </button>
                    )}
                    {run.status === "approved" && (
                      <button disabled={busy} onClick={() => runAction(run.id, "pay")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#1baf7a", color: "#fff" }}>
                        <Wallet className="w-4 h-4" />ثبت پرداخت
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>چاپ / ذخیره PDF</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>بستن</button>
      </div>
      <div dir="rtl" className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none" style={{ background: "#fff", color: "#111" }}>
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold">فیش حقوقی</h2>
          <span className="text-xs">{monthLabel(period)}</span>
        </div>
        <div className="text-sm font-medium">{payslip.employee.name}</div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b"><td className="py-2 text-gray-500">حقوق پایه</td><td className="py-2 text-left">{fmt(payslip.baseSalary)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">کمیسیون</td><td className="py-2 text-left">{fmt(payslip.commissionTotal)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">پاداش</td><td className="py-2 text-left">{fmt(payslip.bonus)}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">کسورات</td><td className="py-2 text-left">-{fmt(payslip.deductions)}</td></tr>
            <tr><td className="py-2 font-bold">خالص قابل‌پرداخت</td><td className="py-2 text-left font-bold">{fmt(payslip.netPay)} تومان</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayslipRow({ payslip, editable, onSave, onPrint }: { payslip: Payslip; editable: boolean; onSave: (id: string, bonus: number, deductions: number) => void; onPrint: () => void }) {
  const [bonus, setBonus] = useState(String(payslip.bonus));
  const [deductions, setDeductions] = useState(String(payslip.deductions));

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{payslip.employee.name}</span>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-primary)" }}>خالص: {fmt(payslip.netPay)}</span>
          <button onClick={onPrint} className="p-1 rounded-md" style={{ color: "var(--text-secondary)" }} title="چاپ فیش حقوقی"><Printer className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div>پایه: {fmt(payslip.baseSalary)}</div>
        <div>کمیسیون: {fmt(payslip.commissionTotal)}</div>
        {editable ? (
          <>
            <label className="flex flex-col gap-1">
              <span>پاداش</span>
              <input value={bonus} onChange={(e) => setBonus(e.target.value)} onBlur={() => onSave(payslip.id, Number(bonus) || 0, Number(deductions) || 0)} type="number" className="px-2 py-1 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </label>
            <label className="flex flex-col gap-1">
              <span>کسورات</span>
              <input value={deductions} onChange={(e) => setDeductions(e.target.value)} onBlur={() => onSave(payslip.id, Number(bonus) || 0, Number(deductions) || 0)} type="number" className="px-2 py-1 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </label>
          </>
        ) : (
          <>
            <div>پاداش: {fmt(payslip.bonus)}</div>
            <div>کسورات: {fmt(payslip.deductions)}</div>
          </>
        )}
      </div>
    </div>
  );
}
