"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowUpRight, Sparkles,
  Briefcase, Users, Receipt, CalendarDays, Wallet, TrendingUp,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/jalali";
import { TEAMMATES, teammateInitial, departmentOf, type TeammateKey } from "@/lib/team/identity";

/**
 * The dashboard home, built as all three phase-1 directions at once rather than
 * a choice between them:
 *
 *   A — the prioritised "what needs you today" list leads the page, because
 *       that is the question a business owner opens the app with.
 *   B — the status figures are there, but only the ones that currently carry
 *       information. Direction B's weakness was a new workspace greeting its
 *       owner with a row of zeros; `meaningfulStats` drops those tiles instead.
 *   C — the team's work is attributed to the teammate who did it, with the same
 *       role name and department colour the sidebar uses, so the engine that
 *       already exists is finally visible as colleagues rather than as logs.
 *
 * Order is deliberate: what needs you, then what the team did for you, then the
 * numbers. Anything that is empty is omitted rather than shown as a zero.
 */

interface AttentionItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

interface TeamActivityItem {
  id: string;
  agent: TeammateKey;
  title: string;
  detail: string;
  href: string;
  at: string;
}

type StatKey = "activeDeals" | "pipelineValue" | "newLeadsThisWeek" | "overdueInvoiceCount" | "monthRevenue" | "upcomingViewings";

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
  meaningfulStats: StatKey[];
  isEmptyWorkspace: boolean;
}

/**
 * Status colours carry meaning, so per the dataviz rules they always ship with
 * an icon and a text label — never colour alone.
 */
function severityStyle(s: AttentionItem["severity"]) {
  if (s === "critical") return { Icon: AlertTriangle, color: "var(--neg)", bg: "rgba(234,90,89,0.14)" };
  if (s === "warning") return { Icon: AlertCircle, color: "var(--warn)", bg: "rgba(217,144,0,0.14)" };
  return { Icon: Info, color: "var(--text-secondary)", bg: "var(--surface-2)" };
}

function severityLabel(s: AttentionItem["severity"], lang: Lang) {
  if (s === "critical") return tri(lang, "فوری", "Urgent", "Dringend");
  if (s === "warning") return tri(lang, "نیاز به تأیید", "Needs approval", "Freigabe nötig");
  return tri(lang, "برنامه‌ریزی‌شده", "Scheduled", "Geplant");
}

export default function HomePage() {
  const { lang } = useTranslation();
  const dir = lang === "fa" ? "rtl" : "ltr";
  const [data, setData] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home/summary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4" dir={dir}>
        <div className="h-7 w-40 rounded-lg" style={{ background: "var(--surface-2)" }} />
        <div className="h-24 rounded-2xl" style={{ background: "var(--surface-1)" }} />
        <div className="h-40 rounded-2xl" style={{ background: "var(--surface-1)" }} />
      </div>
    );
  }
  if (!data) return null;

  const nf = (n: number) => formatNumber(Math.round(n), lang);
  const statMeta: Record<StatKey, { icon: React.ElementType; label: string; value: string; href: string; alarm?: boolean }> = {
    activeDeals: { icon: Briefcase, label: tri(lang, "معاملهٔ باز", "Open deals", "Offene Deals"), value: nf(data.stats.activeDeals), href: "/crm" },
    pipelineValue: { icon: TrendingUp, label: tri(lang, "ارزش پایپلاین", "Pipeline value", "Pipeline-Wert"), value: nf(data.stats.pipelineValue), href: "/crm" },
    newLeadsThisWeek: { icon: Users, label: tri(lang, "لید جدید این هفته", "New leads this week", "Neue Leads diese Woche"), value: nf(data.stats.newLeadsThisWeek), href: "/crm" },
    overdueInvoiceCount: { icon: Receipt, label: tri(lang, "فاکتور معوق", "Overdue invoices", "Überfällige Rechnungen"), value: nf(data.stats.overdueInvoiceCount), href: "/crm?tab=invoices", alarm: true },
    monthRevenue: { icon: Wallet, label: tri(lang, "درآمد این ماه", "Revenue this month", "Umsatz diesen Monat"), value: nf(data.stats.monthRevenue), href: "/accounting" },
    upcomingViewings: { icon: CalendarDays, label: tri(lang, "بازدید پیش رو", "Upcoming viewings", "Anstehende Besichtigungen"), value: nf(data.stats.upcomingViewings), href: "/crm" },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "اتاق فرمان", "Command centre", "Kommandozentrale")}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {tri(lang, "وضعیت کسب‌وکار شما و کارهایی که امروز نیاز به توجه دارند",
            "Where your business stands, and what needs you today",
            "Wie Ihr Geschäft steht und was heute Ihre Aufmerksamkeit braucht")}
        </p>
      </div>

      {data.isEmptyWorkspace && data.teamActivity.length === 0 ? (
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
          {/* ── A: what needs you, first, because that is why the app was opened ── */}
          <section className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <AlertCircle className="w-4 h-4" style={{ color: "var(--primary)" }} />
              {data.attention.length > 0
                ? tri(lang, `${formatNumber(data.attention.length, lang)} کار منتظر شماست`,
                    `${data.attention.length} things need you`,
                    `${data.attention.length} Dinge brauchen Sie`)
                : tri(lang, "نیاز به توجه شما", "Needs your attention", "Braucht Ihre Aufmerksamkeit")}
            </h2>
            {data.attention.length === 0 ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--pos)" }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {tri(lang, "همه‌چیز مرتب است — کاری معوق نمانده.",
                  "All clear — nothing is overdue.",
                  "Alles erledigt — nichts ist überfällig.")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.attention.map((item) => {
                  const { Icon, color, bg } = severityStyle(item.severity);
                  return (
                    <Link key={item.id} href={item.href}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                      style={{ background: "var(--surface-2)" }}>
                      <span className="mt-0.5 rounded-lg p-1.5 flex-shrink-0" style={{ background: bg, color }}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</span>
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
          </section>

          {/* ── C: the same work, attributed to the teammate who did it ────────── */}
          {data.teamActivity.length > 0 && (
            <section className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                {tri(lang, "تیم شما این هفته", "Your team this week", "Ihr Team diese Woche")}
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "کارهایی که بدون دخالت شما انجام شد",
                  "Work done without you having to ask",
                  "Arbeit, die ohne Ihr Zutun erledigt wurde")}
              </p>
              <div className="flex flex-col gap-2">
                {data.teamActivity.map((item) => {
                  const mate = TEAMMATES[item.agent];
                  const dept = departmentOf(item.agent);
                  return (
                    <Link key={item.id} href={item.href}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                      style={{ background: "var(--surface-2)" }}>
                      <span
                        className="mt-0.5 w-8 h-8 rounded-xl grid place-items-center text-xs font-bold flex-shrink-0"
                        style={{ background: dept.tint, color: dept.color }}
                        aria-hidden="true"
                      >
                        {teammateInitial(item.agent, lang)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{mate.name(lang)}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: dept.tint, color: dept.color }}>
                            {dept.label(lang)}
                          </span>
                        </span>
                        <span className="block text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{item.title}</span>
                        <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.detail}</span>
                      </span>
                      <ArrowUpRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── B: the figures, but only those that currently mean something ───── */}
          {data.meaningfulStats.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold mb-2.5 px-1" style={{ color: "var(--text-muted)" }}>
                {tri(lang, "وضعیت کسب‌وکار", "Business at a glance", "Geschäft auf einen Blick")}
              </h2>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {data.meaningfulStats.map((key) => {
                  const m = statMeta[key];
                  const Icon = m.icon;
                  return (
                    <Link key={key} href={m.href}
                      className="rounded-xl p-3.5 flex flex-col gap-1 transition-colors"
                      style={{
                        background: "var(--surface-1)",
                        border: `1px solid ${m.alarm ? "rgba(234,90,89,0.35)" : "var(--border)"}`,
                      }}>
                      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {m.label}
                      </span>
                      <span className="text-lg font-bold" style={{ color: m.alarm ? "var(--neg)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {m.value}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
