import { prisma } from "@/lib/db/prisma";
import { getGrowthSettings } from "./config";
import { loadFacts } from "./facts";
import { evaluate, isPaidActive, onboardingFinished, totalSuccesses, type Segment, type Stage } from "./lifecycle";
import { growthModule } from "./modules";

const DAY = 86_400_000;
const ratio = (a: number, b: number) => b ? Math.round(a * 1000 / b) / 10 : null;

/** Customers only: admins and blocked accounts are excluded from every metric. */
const customerWhere = { role: "USER", isBlocked: false } as const;

async function evaluatedUsers(where: Record<string, unknown> = {}) {
  const settings = await getGrowthSettings(), now = new Date();
  const users = await prisma.user.findMany({ where: { ...customerWhere, ...where }, select: { id: true, name: true, email: true, phone: true, createdAt: true, plan: true, credits: true, growthProfile: { select: { firstTouchId: true, attributionConfidence: true, intendedModule: true, followUpStatus: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const facts = await loadFacts(users.map(u => u.id), settings.thresholds.scoringWindowDays, now);
  return { settings, now, rows: users.map(u => ({ user: u, facts: facts.get(u.id)!, ...evaluate(facts.get(u.id)!, settings, now) })) };
}

export type Range = { from: Date; to: Date };

/**
 * Signup-cohort funnel and KPIs for users who registered inside the range.
 * Conversion counts only server-confirmed payments (Payment.status = SUCCESS).
 */
export async function overview(range: Range) {
  const { rows, settings, now } = await evaluatedUsers({ createdAt: { gte: range.from, lte: range.to } });
  const all = await evaluatedUsers();
  const visitors = await prisma.growthTouch.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, distinct: ["anonId"], select: { anonId: true } });
  const n = rows.length;
  const onboarded = rows.filter(r => onboardingFinished(r.facts)).length;
  const fv = rows.filter(r => r.firstValueAt).length;
  const repeat = rows.filter(r => r.facts.activeDaysWindow >= 2 || totalSuccesses(r.facts) >= 2).length;
  const checkout = rows.filter(r => r.facts.checkoutsWindow > 0 || r.facts.payments.success > 0).length;
  const paid = rows.filter(r => r.facts.payments.success > 0).length;
  const revenue = rows.reduce((s, r) => s + r.facts.payments.revenueToman, 0);
  // Cohort maturity: users younger than the conversion window are not yet comparable.
  const matureCutoff = new Date(now.getTime() - settings.thresholds.scoringWindowDays * DAY);
  const mature = rows.filter(r => r.user.createdAt <= matureCutoff);
  const stageCounts = all.rows.reduce<Record<string, number>>((m, r) => (m[r.stage] = (m[r.stage] ?? 0) + 1, m), {});
  const generation = await generationAttempts(range);
  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpis: {
      signups: n, onboarded, firstValue: fv, activationRate: ratio(fv, n), onboardingRate: ratio(onboarded, n),
      checkoutStarts: checkout, paid, freeToPaid: ratio(paid, n), matureCohort: mature.length, matureFreeToPaid: ratio(mature.filter(r => r.facts.payments.success > 0).length, mature.length),
      revenueToman: revenue,
      payingNow: all.rows.filter(r => isPaidActive(r.facts, now)).length, freeNow: all.rows.filter(r => !isPaidActive(r.facts, now)).length,
      activeNow: all.rows.filter(r => r.facts.lastActiveAt && now.getTime() - r.facts.lastActiveAt.getTime() < settings.thresholds.inactiveDays * DAY).length,
      inactiveNow: all.rows.filter(r => r.segments.includes("inactive")).length, atRiskNow: all.rows.filter(r => r.stage === "at_risk").length,
    },
    funnel: [
      { step: "visitors", count: visitors.length, note: "campaign_or_referral_only" },
      { step: "signups", count: n }, { step: "onboarding", count: onboarded }, { step: "first_value", count: fv },
      { step: "repeat_usage", count: repeat }, { step: "checkout", count: checkout }, { step: "paid", count: paid },
    ],
    stages: stageCounts,
    modules: Object.entries(rows.reduce<Record<string, number>>((m, r) => { for (const k of Object.keys(r.facts.successes)) m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]),
    generation,
  };
}

/**
 * Generation attempts in the range, from the server-recorded events
 * (lib/growth/generation.ts): started, succeeded and failed per tool with the
 * failure reasons, so a failed generation is visible apart from a user who
 * left, plus the new accounts' first success and how long it took.
 */
async function generationAttempts(range: Range) {
  const where = { createdAt: { gte: range.from, lte: range.to } };
  const [events, firsts] = await Promise.all([
    prisma.growthEvent.findMany({ where: { ...where, name: { in: ["generation_started", "generation_succeeded", "generation_failed"] } }, select: { name: true, moduleId: true, metadata: true } }),
    prisma.growthEvent.findMany({ where: { ...where, name: "first_success_achieved" }, select: { metadata: true } }),
  ]);
  const byModule: Record<string, { started: number; succeeded: number; failed: number; reasons: Record<string, number> }> = {};
  for (const e of events) {
    const row = (byModule[e.moduleId ?? "other"] ??= { started: 0, succeeded: 0, failed: 0, reasons: {} });
    if (e.name === "generation_started") row.started++;
    else if (e.name === "generation_succeeded") row.succeeded++;
    else {
      row.failed++;
      let reason = "unknown";
      try { reason = String(JSON.parse(e.metadata).reason ?? "unknown"); } catch { /* keep unknown */ }
      row.reasons[reason] = (row.reasons[reason] ?? 0) + 1;
    }
  }
  const minutes = firsts.map((f) => { try { return Number(JSON.parse(f.metadata).minutesFromSignup); } catch { return NaN; } }).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    modules: Object.entries(byModule).sort((a, b) => b[1].started - a[1].started),
    firstSuccess: { count: firsts.length, medianMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null },
  };
}

/** Per-campaign journey. Attribution = the user's FIRST touch; revenue = all confirmed payments of those users. */
export async function campaignReport() {
  const campaigns = await prisma.growthCampaign.findMany({ orderBy: { createdAt: "desc" } });
  const touches = await prisma.growthTouch.groupBy({ by: ["utmCampaign"], _count: { _all: true }, where: { utmCampaign: { not: null } } });
  const visitors = await prisma.$queryRaw<{ c: string; v: bigint }[]>`SELECT utmCampaign AS c, COUNT(DISTINCT anonId) AS v FROM GrowthTouch WHERE utmCampaign IS NOT NULL GROUP BY utmCampaign`;
  const { rows } = await evaluatedUsers();
  const firstTouchIds = rows.map(r => r.user.growthProfile?.firstTouchId).filter((x): x is string => !!x);
  const first = new Map((await prisma.growthTouch.findMany({ where: { id: { in: firstTouchIds } }, select: { id: true, utmCampaign: true, utmSource: true, referrerHost: true } })).map(t => [t.id, t]));
  const keyFor = (r: typeof rows[number]) => { const t = first.get(r.user.growthProfile?.firstTouchId ?? ""); return t?.utmCampaign ?? (t?.referrerHost ? `ref:${t.referrerHost}` : t?.utmSource ? `src:${t.utmSource}` : "unknown"); };
  const by = new Map<string, typeof rows>();
  for (const r of rows) { const k = keyFor(r); by.set(k, [...(by.get(k) ?? []), r]); }
  const keys = new Set([...campaigns.map(c => c.utmCampaign), ...by.keys(), ...touches.map(t => t.utmCampaign!)]);
  return [...keys].map(key => {
    const c = campaigns.find(x => x.utmCampaign === key), us = by.get(key) ?? [];
    const paid = us.filter(r => r.facts.payments.success > 0).length, revenue = us.reduce((s, r) => s + r.facts.payments.revenueToman, 0);
    return {
      key, campaign: c ? { id: c.id, name: c.name, status: c.status, targetModule: c.targetModule, landingPath: c.landingPath, utmSource: c.utmSource, utmMedium: c.utmMedium, spendToman: c.spendToman, startsAt: c.startsAt, endsAt: c.endsAt, recommendedPlan: c.recommendedPlan, notes: c.notes } : null,
      visits: touches.find(t => t.utmCampaign === key)?._count._all ?? null, visitors: visitors.find(v => v.c === key) ? Number(visitors.find(v => v.c === key)!.v) : null,
      signups: us.length, firstValue: us.filter(r => r.firstValueAt).length, repeat: us.filter(r => r.facts.activeDaysWindow >= 2).length,
      pricingViews: us.filter(r => r.facts.pricingViewsWindow > 0).length, checkouts: us.filter(r => r.facts.checkoutsWindow > 0 || r.facts.payments.success > 0).length,
      paid, revenueToman: revenue, creditsUsed: us.reduce((s, r) => s + r.facts.creditsUsedWindow, 0),
      activationRate: ratio(us.filter(r => r.firstValueAt).length, us.length), conversionRate: ratio(paid, us.length),
      /** Only with admin-entered spend and at least one paying customer; otherwise null (never 0). */
      cacToman: c?.spendToman != null && paid > 0 ? Math.round(c.spendToman / paid) : null,
    };
  }).sort((a, b) => b.signups - a.signups);
}

export type CustomerFilter = { q?: string; stage?: Stage | ""; segment?: Segment | ""; band?: string; page?: number };

export async function customerList(filter: CustomerFilter) {
  const { rows, settings } = await evaluatedUsers();
  const touchIds = rows.map(r => r.user.growthProfile?.firstTouchId).filter((x): x is string => !!x);
  const touches = new Map((await prisma.growthTouch.findMany({ where: { id: { in: touchIds } }, select: { id: true, utmCampaign: true, utmSource: true, referrerHost: true } })).map(t => [t.id, t]));
  const q = (filter.q || "").toLowerCase().trim();
  const filtered = rows.filter(r => (!q || [r.user.name, r.user.email, r.user.phone].some(v => v?.toLowerCase().includes(q)))
    && (!filter.stage || r.stage === filter.stage) && (!filter.segment || r.segments.includes(filter.segment)) && (!filter.band || r.band === filter.band));
  const page = Math.max(1, filter.page || 1), size = 50;
  return {
    total: filtered.length, page, size, settings: { thresholds: settings.thresholds, weights: settings.weights },
    segmentCounts: rows.reduce<Record<string, number>>((m, r) => { for (const s of r.segments) m[s] = (m[s] ?? 0) + 1; return m; }, {}),
    rows: filtered.slice((page - 1) * size, page * size).map(r => {
      const t = touches.get(r.user.growthProfile?.firstTouchId ?? "");
      const preferred = Object.entries(r.facts.successes).sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? r.user.growthProfile?.intendedModule ?? null;
      return {
        id: r.user.id, name: r.user.name, email: r.user.email, phone: r.user.phone, createdAt: r.user.createdAt, plan: r.user.plan, credits: r.user.credits,
        source: t ? (t.utmCampaign ?? t.utmSource ?? t.referrerHost) : null, confidence: r.user.growthProfile?.attributionConfidence ?? "unknown",
        stage: r.stage, score: r.score, band: r.band, segments: r.segments, lastActiveAt: r.facts.lastActiveAt, preferredModule: preferred,
        followUpStatus: r.user.growthProfile?.followUpStatus ?? "none", firstValueAt: r.firstValueAt,
      };
    }),
  };
}

/** Customer 360: identity, attribution, usage, billing, intelligence and a timeline. Prompts and generated content are never included. */
export async function customerDetail(userId: string) {
  const settings = await getGrowthSettings(), now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, role: true, accountType: true, language: true, createdAt: true, lastLoginAt: true, plan: true, planExpiry: true, credits: true, isBlocked: true, onboardingDone: true, growthProfile: true } });
  if (!user) return null;
  const facts = (await loadFacts([userId], settings.thresholds.scoringWindowDays, now)).get(userId)!;
  const ev = evaluate(facts, settings, now);
  const [touches, events, payments, messages, notes, usage] = await Promise.all([
    prisma.growthTouch.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 50 }),
    prisma.growthEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 150, select: { id: true, name: true, moduleId: true, metadata: true, source: true, createdAt: true } }),
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, plan: true, amount: true, status: true, gateway: true, periodMonths: true, createdAt: true } }),
    prisma.growthMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.growthNote.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.usageLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, type: true, credits: true, createdAt: true } }),
  ]);
  const timeline = [
    { at: user.createdAt, type: "signup", label: "user_signed_up", detail: null as string | null },
    ...touches.map(t => ({ at: t.createdAt, type: "attribution", label: "touch", detail: [t.utmSource, t.utmMedium, t.utmCampaign, t.referrerHost, t.landingPath].filter(Boolean).join(" · ") })),
    ...events.filter(e => e.name !== "user_signed_up").map(e => ({ at: e.createdAt, type: e.name.startsWith("onboarding") ? "onboarding" : e.name.includes("generation") || e.name.includes("first_") || e.name.includes("voice") ? "usage" : e.name.includes("pricing") || e.name.includes("upgrade") || e.name.includes("plan") ? "purchase_intent" : "event", label: e.name, detail: [growthModule(e.moduleId)?.name[1], e.source === "client" ? "client" : null].filter(Boolean).join(" · ") || null })),
    ...Object.entries(facts.successes).map(([m, s]) => ({ at: s.first, type: "usage", label: "first_module_success", detail: `${growthModule(m)?.name[1] ?? m} (${s.count})` })),
    ...payments.map(p => ({ at: p.createdAt, type: "billing", label: p.status === "SUCCESS" ? "payment_succeeded" : p.status === "FAILED" ? "checkout_failed" : "checkout_started", detail: `${p.plan} · ${p.amount.toLocaleString("en")} Toman · ${p.gateway}` })),
    ...usage.map(u => ({ at: u.createdAt, type: "credits", label: u.credits >= 0 ? "credits_consumed" : "credits_refunded", detail: `${u.type} · ${u.credits}` })),
    ...messages.map(m => ({ at: m.createdAt, type: "communication", label: `message_${m.status}`, detail: `${m.ruleKey} · ${m.channel}${m.reason ? ` · ${m.reason}` : ""}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    user: { ...user, growthProfile: undefined }, profile: user.growthProfile, touches: { first: touches[0] ?? null, last: touches[touches.length - 1] ?? null, count: touches.length },
    facts: { ...facts, successes: Object.fromEntries(Object.entries(facts.successes).map(([k, v]) => [k, { ...v, name: growthModule(k)?.name ?? [k, k] }])) },
    intelligence: { ...ev, nextAction: nextBestAction(ev.stage, facts, ev.segments) },
    payments, notes, timeline: timeline.slice(0, 250),
  };
}

/** Rule-based next step for the admin; advisory only, never executed automatically. */
export function nextBestAction(stage: Stage, f: { payments: { lastFailedAt: Date | null } }, segments: Segment[]): string {
  if (segments.includes("at_risk_paying")) return f.payments.lastFailedAt ? "help_with_failed_payment" : "check_in_paid_customer";
  if (stage === "purchase_intent") return "offer_plan_guidance";
  if (stage === "engaged") return "explain_paid_benefits";
  if (stage === "activated") return "suggest_second_workflow";
  if (stage === "onboarding" || stage === "signed_up") return "guide_to_first_result";
  if (stage === "churned") return "ask_for_feedback";
  return "none";
}

export function csvEscape(v: unknown): string {
  const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  // Neutralise spreadsheet formulas (CSV injection) and quote every field.
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}
