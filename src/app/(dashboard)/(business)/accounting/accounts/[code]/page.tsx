"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, BookOpen } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";
import AccountingNav from "@/components/accounting/AccountingNav";

interface AccountEntryLine {
  id: string;
  debit: number;
  credit: number;
  memo: string | null;
  entry: { id: string; entryDate: string; memo: string | null; sourceRef: string | null; postedBy: string; isReversed: boolean };
}
interface Account { code: string; name: string; nameEn: string | null; type: string; }

export default function AccountLedgerPage() {
  const { lang, dir, fmtNum: fmt, fmtDate, fmtMonth: monthLabel } = useAccountingLocale();
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
      .catch((e) => setError(e instanceof Error ? e.message : tri(lang, "خطا در بارگذاری", "Failed to load", "Laden fehlgeschlagen")))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "در حال بارگذاری...", "Loading…", "Wird geladen…")}</div>;
  if (error) return <div className="p-6 text-center text-sm" style={{ color: "var(--neg)" }}>{error}</div>;
  if (!account) return null;

  const debitTotal = lines.reduce((s, l) => s + l.debit, 0);
  const creditTotal = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <AccountingNav />
      <div className="flex items-center gap-2">
        <Link href="/accounting/ledger-setup" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><BookOpen className="w-5 h-5" />{account.code} — {account.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تاریخچهٔ کامل اسناد این حساب — همان منبعی که دستیار هوشمند به آن استناد می‌کند", "The full entry history for this account — the same source the AI assistant cites", "Der vollständige Buchungsverlauf dieses Kontos — dieselbe Quelle, die der KI-Assistent zitiert")}</p>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div style={{ color: "var(--text-secondary)" }}>{tri(lang, "جمع بدهکار:", "Total debit:", "Summe Soll:")} <b style={{ color: "var(--text-primary)" }}>{fmt(debitTotal)}</b></div>
          <div style={{ color: "var(--text-secondary)" }}>{tri(lang, "جمع بستانکار:", "Total credit:", "Summe Haben:")} <b style={{ color: "var(--text-primary)" }}>{fmt(creditTotal)}</b></div>
        </div>

        {lines.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز سندی برای این حساب ثبت نشده", "No entries posted to this account yet", "Noch keine Buchungen auf diesem Konto")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-right py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{tri(lang, "تاریخ", "Date", "Datum")}</th>
                  <th className="text-right py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{tri(lang, "شرح", "Description", "Beschreibung")}</th>
                  <th className="text-left py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{tri(lang, "بدهکار", "Debit", "Soll")}</th>
                  <th className="text-left py-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{tri(lang, "بستانکار", "Credit", "Haben")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(l.entry.entryDate).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US")}</td>
                    <td className="py-2 text-xs" style={{ color: "var(--text-primary)" }}>
                      {l.memo || l.entry.memo || "—"}
                      {l.entry.isReversed && <span className="mr-1.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(227,73,72,0.12)", color: "var(--neg)" }}>{tri(lang, "برگشت‌خورده", "Reversed", "Storniert")}</span>}
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
