"use client";

import { AlertTriangle, Info, TrendingDown, TrendingUp, Users } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

export interface SocialAnalysisView {
  dataConfidence: "ok" | "insufficient";
  totalFollowers: number | null;
  followerDelta: number | null;
  daysTracked: number;
  buckets: { weekly: { start: string; delta: number }[]; monthly: { start: string; delta: number }[] };
  growthRatePct: number | null;
  engagementRatePct: number | null;
  audienceQualityPct: number | null;
  correlations: { type: string; posts: number; avgViews: number; avgEngagement: number }[];
  insights: { code: string; severity: "info" | "warn" | "critical"; facts: Record<string, number | string> }[];
}

function insightText(code: string, facts: Record<string, number | string>, lang: Lang): string {
  switch (code) {
    case "growth_slowdown":
      return tri(lang,
        `رشد فالوور ${Math.abs(Number(facts.changePct))}٪ کندتر از میانگین هفته‌های قبل شده (این هفته ${facts.latestWeekDelta}). محتوای این بازه را با بازه‌ی قبل مقایسه کنید.`,
        `Follower growth is ${Math.abs(Number(facts.changePct))}% slower than the previous weeks' average (this week ${facts.latestWeekDelta}). Compare this period's content with the last.`,
        `Das Follower-Wachstum ist ${Math.abs(Number(facts.changePct))}% langsamer als der Durchschnitt der Vorwochen (diese Woche ${facts.latestWeekDelta}).`);
    case "growth_decline":
      return tri(lang,
        `فالوور در حال کاهش است (این هفته ${facts.latestWeekDelta}).`,
        `Followers are declining (this week ${facts.latestWeekDelta}).`,
        `Die Follower gehen zurück (diese Woche ${facts.latestWeekDelta}).`);
    case "low_audience_quality":
      return tri(lang,
        `فقط ${facts.audienceQualityPct}٪ از ${facts.followers} فالوور شما پست‌ها را می‌بینند (میانگین ریچ ${facts.avgReach}). این یعنی بخش بزرگی از فالووربیس غیرفعال است — قبل از تولید محتوای بیشتر، این باید حل شود.`,
        `Only ${facts.audienceQualityPct}% of your ${facts.followers} followers actually see your posts (average reach ${facts.avgReach}). A large part of the follower base is inactive — fix this before producing more content.`,
        `Nur ${facts.audienceQualityPct}% Ihrer ${facts.followers} Follower sehen Ihre Beiträge (Ø Reichweite ${facts.avgReach}). Ein großer Teil ist inaktiv.`);
    case "engagement_collapse":
      return tri(lang,
        `نرخ تعامل ${facts.engagementRatePct}٪ است (روی ${facts.postsMeasured} پست) — کپشن‌ها دعوت به اقدام کافی ندارند.`,
        `Engagement rate is ${facts.engagementRatePct}% across ${facts.postsMeasured} posts — captions lack a strong call to action.`,
        `Die Interaktionsrate liegt bei ${facts.engagementRatePct}% über ${facts.postsMeasured} Beiträge.`);
    case "reels_outperform_static":
      return tri(lang,
        `ریلز ${facts.reelsAvgEngagement} تعامل میانگین دارد در برابر ${facts.staticAvgEngagement} برای پست‌های ثابت — وزن بیشتری به ریلز بدهید.`,
        `Reels average ${facts.reelsAvgEngagement} engagement vs ${facts.staticAvgEngagement} for static posts — shift the mix toward Reels.`,
        `Reels erreichen im Schnitt ${facts.reelsAvgEngagement} Interaktionen gegenüber ${facts.staticAvgEngagement} bei statischen Beiträgen.`);
    case "no_posts_in_window":
      return tri(lang,
        `${facts.daysSinceLastPost} روز است پستی منتشر نشده.`,
        `No post published in ${facts.daysSinceLastPost} days.`,
        `Seit ${facts.daysSinceLastPost} Tagen kein Beitrag veröffentlicht.`);
    case "healthy_growth":
      return tri(lang,
        `رشد این هفته ${facts.changePct}٪ بهتر از میانگین قبلی است (${facts.latestWeekDelta} فالوور).`,
        `This week's growth is ${facts.changePct}% above the prior average (${facts.latestWeekDelta} followers).`,
        `Das Wachstum dieser Woche liegt ${facts.changePct}% über dem bisherigen Durchschnitt (${facts.latestWeekDelta} Follower).`);
    default:
      return code;
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
      {hint && <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</div>}
    </div>
  );
}

export default function GrowthInsights({ analysis, lang }: { analysis: SocialAnalysisView | null; lang: Lang }) {
  if (!analysis) return null;

  const typeLabel = (t: string) =>
    t === "REELS" ? tri(lang, "ریلز", "Reels", "Reels")
      : t === "IMAGE" ? tri(lang, "عکس", "Photo", "Foto")
      : t === "CAROUSEL_ALBUM" ? tri(lang, "آلبوم", "Carousel", "Karussell")
      : t === "VIDEO" ? tri(lang, "ویدیو", "Video", "Video") : t;

  return (
    <div className="mb-5">
      <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
        {tri(lang, "تحلیل رشد", "Growth analysis", "Wachstumsanalyse")}
      </p>

      {analysis.dataConfidence === "insufficient" && (
        <p className="text-[11px] mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(234,179,8,0.12)", color: "#ca8a04" }}>
          {tri(lang,
            "داده هنوز برای تحلیل قابل‌اتکا کافی نیست — اعداد زیر با احتیاط خوانده شوند.",
            "Not enough data for a reliable analysis yet — read the numbers below with caution.",
            "Noch nicht genug Daten für eine belastbare Analyse — Zahlen mit Vorsicht lesen.")}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat
          label={tri(lang, "نرخ رشد هفته", "Weekly growth rate", "Wöchentliche Wachstumsrate")}
          value={analysis.growthRatePct === null ? "—" : `${analysis.growthRatePct > 0 ? "+" : ""}${analysis.growthRatePct}%`}
          hint={tri(lang, "نسبت به میانگین قبل", "vs prior average", "ggü. bisherigem Ø")}
        />
        <Stat
          label={tri(lang, "نرخ تعامل", "Engagement rate", "Interaktionsrate")}
          value={analysis.engagementRatePct === null ? "—" : `${analysis.engagementRatePct}%`}
          hint={tri(lang, "از ریچ", "of reach", "der Reichweite")}
        />
        <Stat
          label={tri(lang, "کیفیت فالوور", "Audience quality", "Follower-Qualität")}
          value={analysis.audienceQualityPct === null ? "—" : `${analysis.audienceQualityPct}%`}
          hint={tri(lang, "ریچ به فالوور", "reach ÷ followers", "Reichweite ÷ Follower")}
        />
        <Stat
          label={tri(lang, "بازه‌ی رصد", "Tracked", "Erfasst")}
          value={`${analysis.daysTracked} ${tri(lang, "روز", "days", "Tage")}`}
          hint={analysis.followerDelta === null ? undefined : `${analysis.followerDelta >= 0 ? "+" : ""}${analysis.followerDelta}`}
        />
      </div>

      {analysis.insights.length > 0 && (
        <div className="space-y-2 mb-3">
          {analysis.insights.map((i, idx) => {
            const color = i.severity === "critical" ? "#dc2626" : i.severity === "warn" ? "#ca8a04" : "#16a34a";
            const bg = i.severity === "critical" ? "rgba(239,68,68,0.1)" : i.severity === "warn" ? "rgba(234,179,8,0.12)" : "rgba(34,197,94,0.1)";
            const Icon = i.severity === "critical" ? TrendingDown : i.severity === "warn" ? AlertTriangle : i.code === "healthy_growth" ? TrendingUp : Info;
            return (
              <div key={`${i.code}-${idx}`} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs leading-6" style={{ background: bg, color }}>
                <Icon className="w-4 h-4 flex-shrink-0 mt-1" />
                <span>{insightText(i.code, i.facts, lang)}</span>
              </div>
            );
          })}
        </div>
      )}

      {analysis.buckets.weekly.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: "var(--text-secondary)" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="text-start py-1.5 pe-3">{tri(lang, "هفته", "Week", "Woche")}</th>
                <th className="text-start py-1.5 pe-3">{tri(lang, "تغییر فالوور", "Follower change", "Follower-Änderung")}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.buckets.weekly.slice(-8).map((b) => (
                <tr key={b.start} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-1.5 pe-3">{b.start}</td>
                  <td className="py-1.5 pe-3" style={{ color: b.delta > 0 ? "#16a34a" : b.delta < 0 ? "#dc2626" : "var(--text-muted)" }}>
                    {b.delta > 0 ? "+" : ""}{b.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analysis.correlations.length > 1 && (
        <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <Users className="w-3.5 h-3.5" />
          {tri(lang, "بهترین فرمت بر اساس تعامل:", "Best format by engagement:", "Bestes Format nach Interaktion:")}{" "}
          <strong style={{ color: "var(--text-primary)" }}>{typeLabel(analysis.correlations[0].type)}</strong>
          {" "}({analysis.correlations[0].avgEngagement} {tri(lang, "میانگین تعامل", "avg engagement", "Ø Interaktion")})
        </p>
      )}
    </div>
  );
}
