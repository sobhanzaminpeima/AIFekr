"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowUpRight,
  Briefcase, Users, Receipt, CalendarDays, Wallet, Sparkles,
  Brain, PenLine,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/jalali";

interface AttentionItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

interface HomeSummary {
  stats: {
    activeDeals: number;
    pipelineValue: number;
    newLeadsThisWeek: number;
    overdueInvoiceCount: number;
    overdueInvoiceTotal: number;
    monthRevenue: number;
    upcomingViewings: number;
  };
  attention: AttentionItem[];
  teamActivity: TeamActivityItem[];
  isEmptyWorkspace: boolean;
}

interface TeamActivityItem {
  id: string;
  agent: "ceo" | "content";
  title: string;
  detail: string;
  href: string;
  at: string;
}

/**
 * Status colours carry meaning, so per the dataviz rules they always ship with
 * an icon and a text label — never colour alone.
 */
function severityStyle(s: AttentionItem["severity"]) {
  switch (s) {
    case "critical": return { color: "var(--neg)", bg: "rgba(198,47,46,0.10)", Icon: AlertTriangle };
    case "warning": return { color: "var(--warn)", bg: "rgba(217,144,0,0.12)", Icon: AlertCircle };
    default: return { color: "var(--text-secondary)", bg: "var(--surface-2)", Icon: Info };
  }
}

function severityLabel(s: AttentionItem["severity"], lang: Lang) {
  switch (s) {
    case "critical": return tri(lang, "فوری", "Urgent", "Dringend");
    case "warning": return tri(lang, "نیاز به پیگیری", "Needs follow-up", "Nachfassen");
    default: return tri(lang, "برای اطلاع", "For information", "Zur Info");
  }
}

export default function HomePage() {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const [data, setData] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/home/summary", { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch(() => setError(tri(lang, "خطا در بارگذاری", "Failed to load", "Laden fehlgeschlagen")));
  }, [lang]);

  const fmt = (n: number) => formatNumber(Math.round(n), lang);

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center" dir={dir}>
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-secondary)" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
        <div className="h-7 w-56 rounded-lg animate-pulse" style={{ background: "var(--surface-2)" }} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--surface-1)" }} />
          ))}
        </div>
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--surface-1)" }} />
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "خانه", "Home", "Startseite")}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {tri(lang, "وضعیت کسب‌وکار شما و کارهایی که امروز نیاز به توجه دارند",
            "Where your business stands, and what needs you today",
            "Wie Ihr Geschäft steht und was heute Ihre Aufmerksamkeit braucht")}
        </p>
      </div>

      {data.isEmptyWorkspace ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--primary)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "هنوز داده‌ای برای نمایش نیست", "Nothing to report yet", "Noch nichts zu berichten")}
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "با افزودن اولین مخاطب یا ملک، این صفحه شروع به کار می‌کند.",
              "Add your first contact or property and this page starts working.",
              "Fügen Sie Ihren ersten Kontakt oder Ihre erste Immobilie hinzu, dann füllt sich diese Seite.")}
          </p>
          <Link href="/crm" className="inline-block px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
            {tri(lang, "شروع از CRM", "Start in CRM", "Mit dem CRM starten")}
          </Link>
        </div>
      ) : (
        <>
          {/* Counts only — no invented metrics to pad the row. */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat icon={<Briefcase className="w-4 h-4" />} label={tri(lang, "معامله‌های باز", "Open deals", "Offene Deals")} value={fmt(s.activeDeals)} href="/crm" />
            <Stat icon={<Wallet className="w-4 h-4" />} label={tri(lang, "ارزش پایپ‌لاین", "Pipeline value", "Pipeline-Wert")} value={fmt(s.pipelineValue)} href="/crm" />
            <Stat icon={<Users className="w-4 h-4" />} label={tri(lang, "سرنخ جدید (۷ روز)", "New leads (7d)", "Neue Leads (7 T.)")} value={fmt(s.newLeadsThisWeek)} href="/crm?tab=contacts" />
            <Stat icon={<Receipt className="w-4 h-4" />} label={tri(lang, "درآمد این ماه", "Revenue this month", "Umsatz diesen Monat")} value={fmt(s.monthRevenue)} href="/accounting" />
            <Stat icon={<CalendarDays className="w-4 h-4" />} label={tri(lang, "بازدید ۷ روز آینده", "Viewings (next 7d)", "Besichtigungen (7 T.)")} value={fmt(s.upcomingViewings)} href="/crm?tab=viewings" />
          </div>

          {/* The part that makes this a workspace rather than a wall of cards. */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "نیاز به توجه شما", "Needs your attention", "Braucht Ihre Aufmerksamkeit")}
            </h2>

            {data.attention.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: "var(--pos)" }} />
                {tri(lang, "چیزی معوق نمانده — همه‌چیز مرتب است.", "Nothing is overdue — you're all clear.", "Nichts ist überfällig — alles erledigt.")}
              </div>
            ) : (
              <div className="space-y-2">
                {data.attention.map((item) => {
                  const { color, bg, Icon } = severityStyle(item.severity);
                  return (
                    <Link key={item.id} href={item.href}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:opacity-90"
                      style={{ background: "var(--surface-2)" }}>
                      <span className="mt-0.5 rounded-lg p-1.5 flex-shrink-0" style={{ background: bg, color }}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</span>
                        <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.detail}</span>
                      </span>
                      {/* severity is spelled out, never colour-only */}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap" style={{ background: bg, color }}>
                        {severityLabel(item.severity, lang)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </>
      )}

      {/* What the AI team actually did. Rendered only when it did something --
          no "your team is standing by" filler, per the no-fake-data rule. */}
      {data.teamActivity.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
            {tri(lang, "تیم شما این هفته چه کرد", "What your team did this week", "Was Ihr Team diese Woche getan hat")}
          </h2>
          <div className="flex flex-col gap-2">
            {data.teamActivity.map((item) => {
              const Icon = item.agent === "ceo" ? Brain : PenLine;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="mt-0.5 rounded-lg p-1.5 flex-shrink-0" style={{ background: "var(--surface-1)", color: "var(--primary)" }}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</span>
                    <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.detail}</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {[
          { href: "/crm", label: tri(lang, "مدیریت مشتریان", "CRM", "CRM") },
          { href: "/accounting", label: tri(lang, "حسابداری", "Accounting", "Buchhaltung") },
          { href: "/business-doctor", label: tri(lang, "دکتر کسب‌وکار", "Business Doctor", "Business Doctor") },
          { href: "/ceo", label: tri(lang, "مشاور مدیرعامل", "CEO Advisor", "CEO-Berater") },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl p-3.5 block transition-colors hover:opacity-90"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--text-muted)" }}>
        {icon}
        <span className="text-xs truncate">{label}</span>
        <ArrowUpRight className="w-3 h-3 ms-auto flex-shrink-0" />
      </div>
      <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
    </Link>
  );
}
