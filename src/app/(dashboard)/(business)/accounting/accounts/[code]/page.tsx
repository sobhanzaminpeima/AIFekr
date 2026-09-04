"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

interface AccountEntryLine {
  id: string;
  debit: number;
  credit: number;
  memo: string | null;
  entry: { id: string; entryDate: string; memo: string | null; sourceRef: string | null; postedBy: string; isReversed: boolean };
}
interface Account { code: string; name: string; nameEn: string | null; type: string; }

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fa-IR");
}

export default function AccountLedgerPage() {
  const params = useParams();
  const code = params.code as string;
  const [account, setAccount] = useState<Account | null>(null);
  const [lines, setLines] = useState<AccountEntryLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/accounting/accounts/${code}/entries`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setAccount(j.account);
        setLines(j.lines);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>;
  if (error) return <div className="p-6 text-center text-sm" style={{ color: "#e34948" }}>{error}</div>;
  if (!account) return null;

  const debitTotal = lines.reduce((s, l) => s + l.debit, 0);
  const creditTotal = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/accounting/ledger-setup" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><ArrowRight className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><BookOpen className="w-5 h-5" />{account.code} — {account.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>تاریخچهٔ کامل اسناد این حساب — همان منبعی که دستیار هوشمند به آن استناد می‌کند</p>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div style={{ color: "var(--text-secondary)" }}>جمع بدهکار: <b style={{ color: "var(--text-primary)" }}>{fmt(debitTotal)}</b></div>
          <div style={{ color: "var(--text-secondary)" }}>جمع بستانکار: <b style={{ color: "var(--text-primary)" }}>{fmt(creditTotal)}</b></div>
        </div>

        {lines.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>هنوز سندی برای این حساب ثبت نشده</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-right py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>تاریخ</th>
                  <th className="text-right py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>شرح</th>
                  <th className="text-left py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>بدهکار</th>
                  <th className="text-left py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>بستانکار</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(l.entry.entryDate).toLocaleDateString("fa-IR")}</td>
                    <td className="py-2 text-xs" style={{ color: "var(--text-primary)" }}>
                      {l.memo || l.entry.memo || "—"}
                      {l.entry.isReversed && <span className="mr-1.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(227,73,72,0.12)", color: "#e34948" }}>برگشت‌خورده</span>}
                    </td>
                    <td className="py-2 text-xs text-left" style={{ color: l.debit ? "var(--text-primary)" : "var(--text-muted)" }}>{l.debit ? fmt(l.debit) : "—"}</td>
                    <td className="py-2 text-xs text-left" style={{ color: l.credit ? "var(--text-primary)" : "var(--text-muted)" }}>{l.credit ? fmt(l.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
