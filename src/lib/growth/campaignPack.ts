import { prisma } from "@/lib/db/prisma";
import { getGrowthSettings } from "./config";
import { loadFacts } from "./facts";
import { firstValueAt, type CustomerFacts } from "./lifecycle";
import { growthModule } from "./modules";
import { csvEscape } from "./analytics";

/**
 * Campaign report "AI analysis pack": aggregated and anonymized by design.
 * It contains only counts, rates, sums, medians and per-day series: no user id,
 * name, email, phone, prompt, transcript or message text ever enters it, so it
 * is safe to paste into an external AI. Money comes from Payment (status SUCCESS)
 * and credits from CreditLedgerEntry, the only ledger.
 */

const DAY = 86_400_000, HOUR = 3_600_000;
const rate = (a: number, b: number) => b > 0 ? Math.round((a / b) * 1000) / 10 : null;
const median = (xs: number[]) => quantile(xs, 0.5);
function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round((s[lo] + (s[hi] - s[lo]) * (i - lo)) * 10) / 10;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
/** ISO week start (Monday, UTC) of a date. */
export function weekKey(d: Date) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return dayKey(x); }

/** The attribution key of a first touch, the same rule as the Campaigns table (analytics.campaignReport). */
export { touchKey } from "./attribution";
import { touchKey } from "./attribution";

export const DEFINITIONS: Record<string, string> = {
  scope: "Users are AIFekr platform customers (role USER, not blocked) who SIGNED UP inside the date range, grouped by the campaign of their FIRST attribution touch. Users without a touch are 'unknown'. Visits and visitors count touches CREATED inside the range.",
  visits: "Landing touches recorded for the campaign in the range (repeat visits within 30 minutes count once).",
  visitors: "Distinct anonymous visitor ids among those touches.",
  signups: "Users who signed up in the range whose first touch belongs to the campaign.",
  signupRate: "signups / visitors × 100. Denominator: visitors. Can exceed 100 when a visitor signed up on another device.",
  activated: "Signed-up users with at least one real successful result (a generated asset, READY audio, an assistant reply, a ≥30 s AIFekr Live call, a saved CRM contact, a finished SEO audit…), measured up to report time.",
  activationRate: "activated / signups × 100. Denominator: signups.",
  hoursToFirstValueMedian: "Median hours from sign-up to the first successful result, among activated users. p75 is the 75th percentile.",
  returnedAnotherDay: "Signed-up users active on 2+ distinct days in the scoring window.",
  pricingViewers: "Signed-up users who viewed pricing/plans or clicked an upgrade prompt in the scoring window.",
  checkoutStarters: "Signed-up users with at least one Payment row (any status) after sign-up and up to the range end.",
  buyers: "Signed-up users with at least one SUCCESS payment between sign-up and the range end.",
  purchaseRate: "buyers / signups × 100. Denominator: signups.",
  paidAfterActivationRate: "buyers who were activated / activated × 100. Denominator: activated.",
  hoursToPurchaseMedian: "Median hours from sign-up to the first SUCCESS payment, among buyers.",
  revenueToman: "Sum of SUCCESS Payment.amount (Toman, after any wallet discount) of the campaign's users, between sign-up and the range end.",
  payments: "Number of SUCCESS payments counted in revenueToman.",
  creditsSpent: "Credits spent by the campaign's users in the range: −(sum of negative CreditLedgerEntry.delta of type SPEND).",
  creditsGranted: "Credits added in the range by type (SIGNUP_GRANT, PURCHASE, REFERRAL_BONUS, ADMIN_ADJUSTMENT, REFUND…), from CreditLedgerEntry.",
  moduleUsers: "Signed-up users with at least one successful result in each module (one user can count in several modules).",
  firstModule: "The module of each activated user's FIRST successful result.",
  followups: "Follow-up engine jobs for the campaign's users, processed in the range, by status (sent, dry_run = recorded but not sent, holdout, suppressed, failed, cancelled) and reason.",
  daily: "Per UTC day: visits and visitors (by touch date), signups (by sign-up date), first values (by first-result date), buyers and revenue (by payment date), for the campaign's users.",
  cohorts: "Per sign-up week (Monday, UTC): users, activation % and purchase % measured up to report time / range end.",
  rounding: "Rates are percentages with one decimal; null means the denominator is 0 (not zero).",
};

type Scalar = Record<string, number | null>;
export type CampaignBlock = {
  key: string; name: string | null; utm: { source: string | null; medium: string | null; landingPath: string | null; targetModule: string | null; status: string | null; spendToman: number | null };
  funnel: Scalar; timing: Scalar; revenue: Scalar; credits: { spent: number; granted: Record<string, number> };
  moduleUsers: Record<string, number>; firstModule: Record<string, number>; followups: Record<string, number>;
  daily: { day: string; visits: number; visitors: number; signups: number; firstValues: number; buyers: number; revenueToman: number }[];
  cohorts: { week: string; users: number; activationRate: number | null; purchaseRate: number | null }[];
};

const chunks = <T,>(xs: T[], n = 900) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Builds the pack. `campaign` limits it to one attribution key; otherwise every key with activity in the range. */
export async function campaignPack(range: { from: Date; to: Date }, campaign?: string | null) {
  const settings = await getGrowthSettings(), now = new Date(), end = range.to < now ? range.to : now;
  const users = await prisma.user.findMany({ where: { role: "USER", isBlocked: false, createdAt: { gte: range.from, lte: range.to } }, select: { id: true, createdAt: true, growthProfile: { select: { firstTouchId: true } } }, take: 50_000 });
  const firstIds = users.map(u => u.growthProfile?.firstTouchId).filter((x): x is string => !!x);
  const firstTouches = new Map<string, { utmCampaign: string | null; utmSource: string | null; referrerHost: string | null }>();
  for (const c of chunks(firstIds)) for (const t of await prisma.growthTouch.findMany({ where: { id: { in: c } }, select: { id: true, utmCampaign: true, utmSource: true, referrerHost: true } })) firstTouches.set(t.id, t);
  const keyOf = new Map(users.map(u => [u.id, touchKey(firstTouches.get(u.growthProfile?.firstTouchId ?? ""))]));
  const touches = await prisma.growthTouch.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: { anonId: true, utmCampaign: true, utmSource: true, utmMedium: true, referrerHost: true, landingPath: true, createdAt: true }, take: 200_000 });
  const campaigns = await prisma.growthCampaign.findMany();
  const keys = new Set<string>([...keyOf.values(), ...touches.map(t => touchKey(t))]);
  const wanted = campaign ? [campaign] : [...keys].sort();

  // Facts, payments, ledger and follow-ups for every in-scope user (chunked IN lists).
  const scoped = users.filter(u => wanted.includes(keyOf.get(u.id)!));
  const ids = scoped.map(u => u.id);
  const facts = new Map<string, CustomerFacts>();
  const payments: { userId: string; amount: number; status: string; createdAt: Date }[] = [];
  const ledger: { userId: string; delta: number; type: string }[] = [];
  const jobs: { userId: string; status: string; reason: string | null }[] = [];
  for (const c of chunks(ids)) {
    for (const [k, v] of await loadFacts(c, settings.thresholds.scoringWindowDays, now)) facts.set(k, v);
    payments.push(...await prisma.payment.findMany({ where: { userId: { in: c }, createdAt: { lte: end } }, select: { userId: true, amount: true, status: true, createdAt: true } }));
    ledger.push(...await prisma.creditLedgerEntry.findMany({ where: { userId: { in: c }, teamId: null, createdAt: { gte: range.from, lte: range.to } }, select: { userId: true, delta: true, type: true } }));
    jobs.push(...await prisma.followupJob.findMany({ where: { userId: { in: c }, processedAt: { gte: range.from, lte: range.to } }, select: { userId: true, status: true, reason: true } }));
  }

  const blocks: CampaignBlock[] = wanted.map(key => {
    const us = scoped.filter(u => keyOf.get(u.id) === key), set = new Set(us.map(u => u.id));
    const ts = touches.filter(t => touchKey(t) === key);
    const c = campaigns.find(x => x.utmCampaign === key) ?? null;
    const mode = (xs: (string | null)[]) => { const m = new Map<string, number>(); for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
    const created = new Map(us.map(u => [u.id, u.createdAt]));
    const fv = us.map(u => ({ u, at: firstValueAt(facts.get(u.id)!) })).filter(x => x.at);
    const pay = payments.filter(p => set.has(p.userId) && p.createdAt >= created.get(p.userId)!);
    const ok = pay.filter(p => p.status === "SUCCESS");
    const firstPaid = new Map<string, Date>();
    for (const p of ok) if (!firstPaid.has(p.userId) || p.createdAt < firstPaid.get(p.userId)!) firstPaid.set(p.userId, p.createdAt);
    const buyers = firstPaid.size, activatedIds = new Set(fv.map(x => x.u.id));
    const visitors = new Set(ts.map(t => t.anonId)).size;
    const moduleUsers: Record<string, number> = {}, firstModule: Record<string, number> = {};
    for (const u of us) {
      const s = facts.get(u.id)!.successes;
      for (const m of Object.keys(s)) moduleUsers[m] = (moduleUsers[m] ?? 0) + 1;
      const first = Object.entries(s).sort((a, b) => a[1].first.getTime() - b[1].first.getTime())[0];
      if (first) firstModule[first[0]] = (firstModule[first[0]] ?? 0) + 1;
    }
    const granted: Record<string, number> = {};
    let spent = 0;
    for (const l of ledger.filter(l => set.has(l.userId))) { if (l.delta < 0 && l.type === "SPEND") spent -= l.delta; else if (l.delta > 0) granted[l.type] = (granted[l.type] ?? 0) + l.delta; }
    const followups: Record<string, number> = {};
    for (const j of jobs.filter(j => set.has(j.userId))) { const k = j.reason ? `${j.status}:${j.reason}` : j.status; followups[k] = (followups[k] ?? 0) + 1; }

    const days = new Map<string, CampaignBlock["daily"][number]>();
    const day = (k: string) => { if (!days.has(k)) days.set(k, { day: k, visits: 0, visitors: 0, signups: 0, firstValues: 0, buyers: 0, revenueToman: 0 }); return days.get(k)!; };
    for (let t = Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate()); t <= range.to.getTime(); t += DAY) day(dayKey(new Date(t)));
    const dayVisitors = new Map<string, Set<string>>();
    for (const t of ts) { const k = dayKey(t.createdAt); day(k).visits++; dayVisitors.set(k, new Set([...(dayVisitors.get(k) ?? []), t.anonId])); }
    for (const [k, v] of dayVisitors) day(k).visitors = v.size;
    for (const u of us) day(dayKey(u.createdAt)).signups++;
    for (const x of fv) if (x.at! <= range.to) day(dayKey(x.at!)).firstValues++;
    for (const [, at] of firstPaid) day(dayKey(at)).buyers++;
    for (const p of ok) day(dayKey(p.createdAt)).revenueToman += p.amount;

    const weeks = new Map<string, string[]>();
    for (const u of us) { const w = weekKey(u.createdAt); weeks.set(w, [...(weeks.get(w) ?? []), u.id]); }
    return {
      key, name: c?.name ?? null,
      utm: { source: c?.utmSource ?? mode(ts.map(t => t.utmSource)), medium: c?.utmMedium ?? mode(ts.map(t => t.utmMedium)), landingPath: c?.landingPath ?? mode(ts.map(t => t.landingPath)), targetModule: c?.targetModule ?? null, status: c?.status ?? null, spendToman: c?.spendToman ?? null },
      funnel: {
        visits: ts.length, visitors, signups: us.length, signupRate: rate(us.length, visitors),
        activated: activatedIds.size, activationRate: rate(activatedIds.size, us.length),
        returnedAnotherDay: us.filter(u => facts.get(u.id)!.activeDaysWindow >= 2).length,
        pricingViewers: us.filter(u => facts.get(u.id)!.pricingViewsWindow > 0).length,
        checkoutStarters: new Set(pay.map(p => p.userId)).size,
        buyers, purchaseRate: rate(buyers, us.length),
        paidAfterActivationRate: rate([...firstPaid.keys()].filter(id => activatedIds.has(id)).length, activatedIds.size),
      },
      timing: {
        hoursToFirstValueMedian: median(fv.map(x => (x.at!.getTime() - x.u.createdAt.getTime()) / HOUR)),
        hoursToFirstValueP75: quantile(fv.map(x => (x.at!.getTime() - x.u.createdAt.getTime()) / HOUR), 0.75),
        hoursToPurchaseMedian: median([...firstPaid].map(([id, at]) => (at.getTime() - created.get(id)!.getTime()) / HOUR)),
      },
      revenue: { revenueToman: ok.reduce((n, p) => n + p.amount, 0), payments: ok.length, cacToman: c?.spendToman != null && buyers > 0 ? Math.round(c.spendToman / buyers) : null },
      credits: { spent, granted },
      moduleUsers, firstModule, followups,
      daily: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      cohorts: [...weeks].sort((a, b) => a[0].localeCompare(b[0])).map(([week, w]) => ({ week, users: w.length, activationRate: rate(w.filter(id => activatedIds.has(id)).length, w.length), purchaseRate: rate(w.filter(id => firstPaid.has(id)).length, w.length) })),
    };
  }).filter(b => campaign || b.funnel.visits! > 0 || b.funnel.signups! > 0);

  const sum = (f: (b: CampaignBlock) => number | null) => blocks.reduce((n, b) => n + (f(b) ?? 0), 0);
  const totals = { visits: sum(b => b.funnel.visits), visitors: sum(b => b.funnel.visitors), signups: sum(b => b.funnel.signups), activated: sum(b => b.funnel.activated), buyers: sum(b => b.funnel.buyers), revenueToman: sum(b => b.revenue.revenueToman), payments: sum(b => b.revenue.payments) };
  return {
    schemaVersion: 1, generatedAt: now.toISOString(), range: { from: range.from.toISOString(), to: range.to.toISOString() }, campaignFilter: campaign ?? "all",
    currency: "IRT (Toman)", privacy: "Aggregated and anonymized: counts, rates, sums and medians only. No user ids, names, emails, phones, prompts, transcripts or message texts.",
    moduleNames: Object.fromEntries([...new Set(blocks.flatMap(b => Object.keys(b.moduleUsers)))].map(m => [m, growthModule(m)?.name[1] ?? m])),
    definitions: DEFINITIONS,
    totals: { ...totals, signupRate: rate(totals.signups, totals.visitors), activationRate: rate(totals.activated, totals.signups), purchaseRate: rate(totals.buyers, totals.signups) },
    campaigns: blocks,
  };
}
export type CampaignPack = Awaited<ReturnType<typeof campaignPack>>;

const SUMMARY_COLUMNS = ["campaign", "name", "utm_source", "utm_medium", "landing_path", "status", "spend_toman", "visits", "visitors", "signups", "signup_rate", "activated", "activation_rate", "returned_another_day", "pricing_viewers", "checkout_starters", "buyers", "purchase_rate", "paid_after_activation_rate", "hours_to_first_value_median", "hours_to_first_value_p75", "hours_to_purchase_median", "revenue_toman", "payments", "cac_toman", "credits_spent", "followups_sent", "followups_suppressed"] as const;

export function packSummaryCsv(p: CampaignPack): string {
  const rows = p.campaigns.map(b => [b.key, b.name, b.utm.source, b.utm.medium, b.utm.landingPath, b.utm.status, b.utm.spendToman, b.funnel.visits, b.funnel.visitors, b.funnel.signups, b.funnel.signupRate, b.funnel.activated, b.funnel.activationRate, b.funnel.returnedAnotherDay, b.funnel.pricingViewers, b.funnel.checkoutStarters, b.funnel.buyers, b.funnel.purchaseRate, b.funnel.paidAfterActivationRate, b.timing.hoursToFirstValueMedian, b.timing.hoursToFirstValueP75, b.timing.hoursToPurchaseMedian, b.revenue.revenueToman, b.revenue.payments, b.revenue.cacToman, b.credits.spent, b.followups.sent ?? 0, Object.entries(b.followups).filter(([k]) => k.startsWith("suppressed")).reduce((n, [, v]) => n + v, 0)]);
  return "﻿" + [SUMMARY_COLUMNS.join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n");
}

export function packDailyCsv(p: CampaignPack): string {
  const head = ["campaign", "day", "visits", "visitors", "signups", "first_values", "buyers", "revenue_toman"];
  return "﻿" + [head.join(","), ...p.campaigns.flatMap(b => b.daily.map(d => [b.key, d.day, d.visits, d.visitors, d.signups, d.firstValues, d.buyers, d.revenueToman].map(csvEscape).join(",")))].join("\n");
}

const fmt = (v: number | null | undefined) => v == null ? "n/a" : String(v);
const table = (head: string[], rows: (string | number | null)[][]) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map(r => `| ${r.map(x => fmt(x as number)).join(" | ")} |`)].join("\n");

/** Markdown pack: a prompt-ready brief for an AI analyst, with every definition. */
export function packMarkdown(p: CampaignPack): string {
  const out: string[] = [
    `# AIFekr campaign report (AI analysis pack)`,
    ``,
    `Range: ${p.range.from.slice(0, 10)} → ${p.range.to.slice(0, 10)} (UTC) · campaigns: ${p.campaignFilter} · generated ${p.generatedAt} · currency ${p.currency}.`,
    ``,
    `> ${p.privacy}`,
    ``,
    `**Suggested task for the AI:** compare campaigns by cost and quality of users (activation, time to first value, purchase rate, revenue), find where each funnel leaks, explain which modules convert, and propose 3 experiments with the metric each should move. Treat n/a as "no data", never as zero; be careful with small numbers.`,
    ``,
    `## Totals`,
    table(["visits", "visitors", "signups", "signup %", "activated", "activation %", "buyers", "purchase %", "revenue (Toman)"], [[p.totals.visits, p.totals.visitors, p.totals.signups, p.totals.signupRate, p.totals.activated, p.totals.activationRate, p.totals.buyers, p.totals.purchaseRate, p.totals.revenueToman]]),
    ``,
    `## Campaign funnel`,
    table(["campaign", "source/medium", "visits", "visitors", "signups", "signup %", "activated", "activation %", "buyers", "purchase %", "revenue", "spend", "CAC"],
      p.campaigns.map(b => [b.key, `${b.utm.source ?? "?"}/${b.utm.medium ?? "?"}`, b.funnel.visits, b.funnel.visitors, b.funnel.signups, b.funnel.signupRate, b.funnel.activated, b.funnel.activationRate, b.funnel.buyers, b.funnel.purchaseRate, b.revenue.revenueToman, b.utm.spendToman, b.revenue.cacToman])),
    ``,
    `## Timing (hours)`,
    table(["campaign", "to first value (median)", "to first value (p75)", "to purchase (median)", "returned another day", "pricing viewers", "checkout starters"],
      p.campaigns.map(b => [b.key, b.timing.hoursToFirstValueMedian, b.timing.hoursToFirstValueP75, b.timing.hoursToPurchaseMedian, b.funnel.returnedAnotherDay, b.funnel.pricingViewers, b.funnel.checkoutStarters])),
  ];
  for (const b of p.campaigns) {
    out.push(``, `## ${b.key}${b.name ? ` — ${b.name}` : ""}`);
    out.push(`Landing ${b.utm.landingPath ?? "?"} · status ${b.utm.status ?? "not registered"} · credits spent ${b.credits.spent} · granted ${Object.entries(b.credits.granted).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
    out.push(`Module users: ${Object.entries(b.moduleUsers).map(([k, v]) => `${p.moduleNames[k] ?? k} ${v}`).join(", ") || "none"}. First module: ${Object.entries(b.firstModule).map(([k, v]) => `${p.moduleNames[k] ?? k} ${v}`).join(", ") || "none"}.`);
    out.push(`Follow-ups: ${Object.entries(b.followups).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.`);
    const active = b.daily.filter(d => d.visits || d.signups || d.firstValues || d.buyers);
    if (active.length) out.push(``, table(["day", "visits", "visitors", "signups", "first values", "buyers", "revenue"], active.map(d => [d.day, d.visits, d.visitors, d.signups, d.firstValues, d.buyers, d.revenueToman])));
    if (b.cohorts.length) out.push(``, table(["signup week", "users", "activation %", "purchase %"], b.cohorts.map(c => [c.week, c.users, c.activationRate, c.purchaseRate])));
  }
  out.push(``, `## Definitions`, ...Object.entries(p.definitions).map(([k, v]) => `- **${k}**: ${v}`));
  return out.join("\n") + "\n";
}
