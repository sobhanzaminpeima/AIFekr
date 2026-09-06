"use client";

import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { formatListingPrice } from "@/lib/industry/realEstate/listingFormat";

/**
 * The page an owner reaches from the link in their statement email.
 *
 * "Send to owner" used to be email-only — the figures lived in the email body
 * and nowhere else, so the owner had no page to reopen, forward, or check on a
 * phone without searching their inbox. This closes that gap the same way
 * /p/[id] closes it for a property listing: an unauthenticated page keyed by
 * an unguessable token, showing only what that one token was issued for.
 */

interface StatementEntry {
  date: string;
  description: string;
  category: string;
  income: number | null;
  expense: number | null;
}

interface PublicStatement {
  month: string;
  currency: string;
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  managementFee: number;
  ownerShare: number;
  sentAt: string | null;
  property: { title: string; address: string; city: string | null };
  entries: StatementEntry[];
}

export default function OwnerStatementPage({ params }: { params: { token: string } }) {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const [statement, setStatement] = useState<PublicStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/public/owner-statement/${params.token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.statement) setStatement(d.statement);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }
  if (notFound || !statement) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={dir} style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
        {tri(lang, "گزارشی با این لینک یافت نشد", "No statement found for this link", "Für diesen Link wurde keine Abrechnung gefunden")}
      </div>
    );
  }

  const numLocale = lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US";
  const monthLabel = new Date(statement.month).toLocaleDateString(numLocale, { year: "numeric", month: "long" });
  const money = (n: number) => formatListingPrice(n, statement.currency, lang);
  const sep = tri(lang, "، ", ", ", ", ");

  const CATEGORY_LABEL: Record<string, string> = {
    guest_stay: tri(lang, "اقامت مهمان", "Guest stay", "Gästeaufenthalt"),
    maintenance: tri(lang, "نگهداری", "Maintenance", "Instandhaltung"),
    utilities: tri(lang, "قبوض", "Utilities", "Nebenkosten"),
    consumables: tri(lang, "مصرفی", "Consumables", "Verbrauchsmaterial"),
    other: tri(lang, "سایر", "Other", "Sonstiges"),
  };

  return (
    <div dir={dir} className="min-h-screen py-10 px-4" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-2xl mx-auto rounded-2xl p-6 space-y-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl p-2 flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{statement.property.title}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {statement.property.address}{statement.property.city ? `${sep}${statement.property.city}` : ""}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {tri(lang, "گزارش تسویه", "Owner statement", "Eigentümerabrechnung")} — {monthLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "سود خالص", "Net profit", "Nettogewinn")}</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>{money(statement.netProfit)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "کارمزد مدیریت", "Management fee", "Verwaltungsgebühr")}</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>{money(statement.managementFee)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(234,88,12,0.1)" }}>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "سهم مالک", "Owner share", "Anteil des Eigentümers")}</p>
            <p className="text-sm font-bold mt-1" style={{ color: "var(--primary)" }}>{money(statement.ownerShare)}</p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
            {tri(lang, "جزئیات", "Details", "Details")}
          </h2>
          <div className="flex flex-col gap-1.5">
            {statement.entries.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm rounded-lg p-2.5" style={{ background: "var(--surface-2)" }}>
                <div className="min-w-0">
                  <p style={{ color: "var(--text-primary)" }}>{e.description}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(e.date).toLocaleDateString(numLocale)}{sep}{CATEGORY_LABEL[e.category] || e.category}
                  </p>
                </div>
                <span className="flex-shrink-0 font-medium" style={{ color: e.income ? "var(--pos)" : "var(--neg)" }}>
                  {e.income ? `+${money(e.income)}` : e.expense ? `-${money(e.expense)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pt-2 space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {tri(lang, "این گزارش توسط آژانس ملک ارسال شده و فقط با این لینک قابل مشاهده است.",
              "This statement was sent by the property agency and is viewable only with this link.",
              "Diese Abrechnung wurde von der Immobilienagentur gesendet und ist nur über diesen Link einsehbar.")}
          </p>
          <a href="/owner/login" className="text-[11px] font-medium underline" style={{ color: "var(--primary)" }}>
            {tri(lang, "ورود به پنل مالک برای دیدن همهٔ گزارش‌ها", "Open the owner portal to see every statement", "Zum Eigentümerportal für alle Abrechnungen")}
          </a>
        </div>
      </div>
    </div>
  );
}
