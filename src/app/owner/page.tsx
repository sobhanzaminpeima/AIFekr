"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, LogOut, FileText, Sparkles, ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { formatListingPrice } from "@/lib/industry/realEstate/listingFormat";

interface OwnerProperty {
  id: string;
  title: string;
  address: string;
  city: string | null;
}
interface OwnerStatement {
  id: string;
  shareToken: string | null;
  month: string;
  currency: string;
  netProfit: number;
  managementFee: number;
  ownerShare: number;
  sentAt: string | null;
  propertyId: string;
  propertyTitle?: string;
}

/**
 * The owner's own login-protected dashboard — before this, the only way an
 * owner could see anything was the single-statement link in each email, with
 * no place to see the trend across months or across more than one property.
 */
export default function OwnerDashboardPage() {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [statements, setStatements] = useState<OwnerStatement[]>([]);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/owner/me");
      if (!meRes.ok) {
        router.replace("/owner/login");
        return;
      }
      const me = await meRes.json();
      setOwnerName(me.owner.name);
      const statRes = await fetch("/api/owner/statements");
      const data = await statRes.json();
      setProperties(data.properties || []);
      setStatements(data.statements || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  const currency = statements[0]?.currency || "IRT";
  const numLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const money = (n: number) => formatListingPrice(n, currency, lang);
  const totalOwnerShare = statements.reduce((s, x) => s + x.ownerShare, 0);
  const totalNet = statements.reduce((s, x) => s + x.netProfit, 0);
  const maxNet = Math.max(1, ...statements.map((s) => s.netProfit));

  // Oldest-first for the trend strip, newest-first for the list below it.
  const chronological = [...statements].reverse();

  async function signOut() {
    await fetch("/api/owner/logout", { method: "POST" });
    setSignedOut(true);
    router.replace("/owner/login");
  }
  if (signedOut) return null;

  return (
    <div dir={dir} className="min-h-screen py-8 px-4" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {tri(lang, `سلام ${ownerName}`, `Hi, ${ownerName}`, `Hallo, ${ownerName}`)}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "پنل مالک", "Owner portal", "Eigentümerportal")}
            </p>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            <LogOut className="w-3.5 h-3.5" />
            {tri(lang, "خروج", "Sign out", "Abmelden")}
          </button>
        </div>

        {/* This owner is looking at their OWN agency's numbers, powered by
            AiFekr behind the scenes -- a natural moment to mention that they
            could run their own portfolio/agency on the same platform,
            without pretending to be their agency's tool. */}
        <a
          href="https://aifekr.com/register"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl p-4 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.14), rgba(234,88,12,0.05))", border: "1px solid rgba(234,88,12,0.3)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="rounded-xl p-2 flex-shrink-0" style={{ background: "rgba(234,88,12,0.18)", color: "var(--primary)" }}>
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {tri(lang, "این گزارش با پلتفرم AiFekr ساخته شده", "This statement was built with AiFekr", "Diese Abrechnung wurde mit AiFekr erstellt")}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {tri(lang, "برای مدیریت ملک‌ها یا کسب‌وکار خودتان، رایگان شروع کنید", "Managing properties or a business of your own? Start free", "Verwalten Sie eigene Immobilien oder ein eigenes Unternehmen? Kostenlos starten")}
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
        </a>

        {properties.length === 0 || statements.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "هنوز گزارشی برای شما ارسال نشده است", "No statements have been sent to you yet", "Es wurden Ihnen noch keine Abrechnungen gesendet")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "مجموع سود خالص", "Total net profit", "Gesamter Nettogewinn")}</p>
                <p className="text-lg font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{money(totalNet)}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "rgba(234,88,12,0.08)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "مجموع سهم شما", "Total owner share", "Gesamter Eigentümeranteil")}</p>
                <p className="text-lg font-bold mt-1" style={{ color: "var(--primary)" }}>{money(totalOwnerShare)}</p>
              </div>
            </div>

            {chronological.length > 1 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "روند سود خالص ماهانه", "Monthly net profit trend", "Monatlicher Nettogewinn-Trend")}
                </p>
                <div className="flex items-end gap-2" style={{ height: 96 }}>
                  {chronological.map((s) => (
                    <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5" title={`${new Date(s.month).toLocaleDateString(numLocale, { month: "short", year: "2-digit" })}: ${money(s.netProfit)}`}>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(4, (s.netProfit / maxNet) * 72)}px`,
                          background: "var(--primary)",
                          opacity: 0.85,
                        }}
                      />
                      <span className="text-[9px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {new Date(s.month).toLocaleDateString(numLocale, { month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "گزارش‌ها", "Statements", "Abrechnungen")}
              </h2>
              {statements.map((s) => (
                <a
                  key={s.id}
                  href={s.shareToken ? `/o/${s.shareToken}` : "#"}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="rounded-lg p-1.5 flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                      <Building2 className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.propertyTitle}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(s.month).toLocaleDateString(numLocale, { year: "numeric", month: "long" })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--primary)" }}>{money(s.ownerShare)}</span>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
