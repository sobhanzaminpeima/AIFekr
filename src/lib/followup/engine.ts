import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getGrowthSettings, type GrowthSettings } from "@/lib/growth/config";
import { loadFacts } from "@/lib/growth/facts";
import { RULES, RULE_USER_SELECT, ruleContext, ruleKeyFor, ruleMessage, type Rule } from "@/lib/growth/automation";
import { realAdapters, type Adapters, type Message } from "./channels";
import { backoffMinutes, capDecision, chooseChannel, holdoutVariant, liveSendBlockers, quietUntil, type Channel } from "./policy";
import { getFollowupSettings, type FollowupSettings } from "./settings";

/**
 * The follow-up engine: the ONLY code path that sends a lifecycle message.
 *
 * plan    -> one FollowupJob per eligible (rule, user, period), at most one open job per user.
 * process -> claims due jobs, re-checks everything against current data
 *            (user, opt-out, suppression, eligibility, paid status, quiet
 *            hours, caps, channel), then records a dry run or really sends.
 *
 * Off by default. "live" needs the engine on in live mode, both growth flags,
 * a channel and the rule switched on (policy.liveSendBlockers). Otherwise the
 * engine at most records dry runs, which never notify anyone.
 */

export type Mode = "dry_run" | "live";

/** Transactional and help messages first, promotional last. */
export const RULE_PRIORITY = ["payment_failed", "post_purchase", "renewal_soon", "welcome", "voice_first_generation", "live_first_session", "getting_started_24h", "second_workflow_day3", "inactive_return", "low_credit_day7", "paid_benefits_day5", "demo_offer_day10", "feedback_day14"];
const rank = (r: Rule) => { const i = RULE_PRIORITY.indexOf(r.key); return i < 0 ? 999 : i; };
export const orderedRules = () => [...RULES].sort((a, b) => rank(a) - rank(b));

/** The mode new jobs are planned in, or null when the engine is off. A live setting falls back to dry run while any global blocker remains. */
export function planningMode(f: FollowupSettings, g: GrowthSettings): Mode | null {
  if (!f.engine_enabled) return null;
  return f.mode === "live" && liveSendBlockers(f, g).length === 0 ? "live" : "dry_run";
}

/** Rules a cycle may plan: every rule in a dry run (nothing is sent); only admin-enabled rules live. The Live rule also needs the Live campaign switch. */
export function plannableRules(mode: Mode, f: FollowupSettings, g: GrowthSettings): Rule[] {
  return orderedRules().filter(r => (mode === "dry_run" || g.messaging.enabledRules.includes(r.key)) && (r.key !== "live_first_session" || f.live_campaign_enabled));
}

export const jobKey = (mode: Mode, key: string) => mode === "live" ? key : `dry:${key}`;
const DAY = 86_400_000;
/** No address, token or long provider text in a stored error. */
const cleanError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/[^\s@]+@[^\s@]+/g, "[email]").slice(0, 300);

/** Send history per user for the caps: real sends (GrowthMessage) live, recorded dry runs in dry-run mode. */
async function capHistory(userIds: string[], mode: Mode, now: Date): Promise<Map<string, Date[]>> {
  const since = new Date(now.getTime() - 7 * DAY), out = new Map<string, Date[]>();
  const push = (u: string, d: Date | null) => { if (d) out.set(u, [...(out.get(u) ?? []), d]); };
  if (mode === "live") for (const m of await prisma.growthMessage.findMany({ where: { userId: { in: userIds }, status: "sent", createdAt: { gte: since } }, select: { userId: true, createdAt: true } })) push(m.userId, m.createdAt);
  else for (const j of await prisma.followupJob.findMany({ where: { userId: { in: userIds }, mode: "dry_run", status: "dry_run", processedAt: { gte: since } }, select: { userId: true, processedAt: true } })) push(j.userId, j.processedAt);
  return out;
}

async function suppressionsFor(userIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const s of await prisma.followupSuppression.findMany({ where: { userId: { in: userIds } }, select: { userId: true, channel: true } })) out.set(s.userId, new Set([...(out.get(s.userId) ?? []), s.channel]));
  return out;
}

/** Dry runs show the channel a live send would use: in-app is assumed on, email follows its switch. */
const channelsFor = (mode: Mode, f: FollowupSettings) => mode === "live" ? f.channels : { ...f.channels, in_app: true };

export type PlanResult = { mode: Mode | null; users: number; planned: number; byRule: Record<string, number> };

export async function planFollowups(opts: { now?: Date; userIds?: string[] } = {}): Promise<PlanResult> {
  const now = opts.now ?? new Date(), [f, g] = await Promise.all([getFollowupSettings(), getGrowthSettings()]);
  const mode = planningMode(f, g);
  if (!mode) return { mode: null, users: 0, planned: 0, byRule: {} };
  const rules = plannableRules(mode, f, g);
  const users = await prisma.user.findMany({ where: { role: "USER", isBlocked: false, ...(opts.userIds ? { id: { in: opts.userIds } } : {}) }, select: { ...RULE_USER_SELECT, email: true }, take: 5000, orderBy: { createdAt: "desc" } });
  const ids = users.map(u => u.id);
  const result: PlanResult = { mode, users: users.length, planned: 0, byRule: {} };
  if (!ids.length || !rules.length) return result;
  const [facts, history, suppressed, jobs, messages] = await Promise.all([
    loadFacts(ids, g.thresholds.scoringWindowDays, now), capHistory(ids, mode, now), suppressionsFor(ids),
    prisma.followupJob.findMany({ where: { userId: { in: ids } }, select: { userId: true, idempotencyKey: true, status: true } }),
    prisma.growthMessage.findMany({ where: { userId: { in: ids } }, select: { idempotencyKey: true } }),
  ]);
  const usedKeys = new Set([...jobs.map(j => j.idempotencyKey), ...messages.map(m => m.idempotencyKey)]);
  const busy = new Set(jobs.filter(j => j.status === "queued" || j.status === "processing").map(j => j.userId));
  for (const u of users) {
    if (busy.has(u.id) || u.growthProfile?.unsubscribedAt || suppressed.get(u.id)?.has("all")) continue;
    if (!capDecision(history.get(u.id) ?? [], now, f.caps).ok) continue;
    const ctx = ruleContext(u, facts.get(u.id)!, g, now);
    for (const rule of rules) {
      if (!rule.eligible(ctx) || (rule.kind === "promotional" && ctx.paid)) continue;
      const key = jobKey(mode, ruleKeyFor(rule, u.id, ctx));
      if (usedKeys.has(key)) continue;
      const channel = chooseChannel({ channels: channelsFor(mode, f), hasEmail: !!u.email, marketingConsent: !!u.growthProfile?.marketingConsent, suppressed: suppressed.get(u.id) ?? new Set() }) ?? "in_app";
      try {
        await prisma.followupJob.create({ data: { userId: u.id, ruleKey: rule.key, channel, mode, idempotencyKey: key, variant: holdoutVariant(u.id, rule.key, f.holdoutPercent), campaignKey: rule.key === "live_first_session" ? "instagram_aifekr_live_launch" : null, scheduledFor: now, nextAttemptAt: now, maxAttempts: f.retry.maxAttempts } });
      } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; throw e; }
      usedKeys.add(key);
      result.planned++; result.byRule[rule.key] = (result.byRule[rule.key] ?? 0) + 1;
      break; // one open follow-up per user at a time
    }
  }
  return result;
}

export type ProcessResult = { disabled: boolean; claimed: number; outcomes: Record<string, number> };

export async function processFollowups(opts: { now?: Date; adapters?: Adapters; limit?: number } = {}): Promise<ProcessResult> {
  const now = opts.now ?? new Date(), adapters = opts.adapters ?? realAdapters;
  const [f, g] = await Promise.all([getFollowupSettings(), getGrowthSettings()]);
  const result: ProcessResult = { disabled: !f.engine_enabled, claimed: 0, outcomes: {} };
  if (!f.engine_enabled) return result;
  const count = (k: string) => { result.outcomes[k] = (result.outcomes[k] ?? 0) + 1; };

  // Crash recovery. An in-app send is one transaction, so a stale claim never delivered and can retry.
  // A stale email claim may have reached the provider: it is failed, never re-sent (at most once).
  const stale = new Date(now.getTime() - 10 * 60_000);
  await prisma.followupJob.updateMany({ where: { status: "processing", claimedAt: { lt: stale }, OR: [{ mode: "dry_run" }, { channel: "in_app" }] }, data: { status: "queued", claimedAt: null } });
  await prisma.followupJob.updateMany({ where: { status: "processing", claimedAt: { lt: stale }, mode: "live", channel: "email" }, data: { status: "failed", reason: "interrupted", processedAt: now } });

  const due = await prisma.followupJob.findMany({ where: { status: "queued", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: Math.min(opts.limit ?? f.batchSize, f.batchSize) });
  if (!due.length) return result;
  const ids = [...new Set(due.map(j => j.userId))];
  const [users, facts, suppressed, historyLive, historyDry] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { ...RULE_USER_SELECT, email: true, role: true, isBlocked: true } }),
    loadFacts(ids, g.thresholds.scoringWindowDays, now), suppressionsFor(ids), capHistory(ids, "live", now), capHistory(ids, "dry_run", now),
  ]);
  const userBy = new Map(users.map(u => [u.id, u]));
  const ruleBy = new Map(RULES.map(r => [r.key, r]));

  for (const job of due) {
    const claim = await prisma.followupJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "processing", claimedAt: now } });
    if (!claim.count) continue;
    result.claimed++;
    const mode = job.mode as Mode;
    const finish = async (status: string, reason: string | null, extra: Prisma.FollowupJobUpdateInput = {}) => {
      await prisma.followupJob.update({ where: { id: job.id }, data: { status, reason, processedAt: now, claimedAt: null, ...extra } });
      count(reason ? `${status}:${reason}` : status);
    };
    const defer = async (until: Date, reason: string) => {
      await prisma.followupJob.update({ where: { id: job.id }, data: { status: "queued", reason, nextAttemptAt: until, claimedAt: null } });
      count(`deferred:${reason}`);
    };

    if (now.getTime() - job.scheduledFor.getTime() > f.expireHours * 3_600_000) { await finish("suppressed", "expired"); continue; }
    const rule = ruleBy.get(job.ruleKey);
    if (!rule) { await finish("cancelled", "unknown_rule"); continue; }
    if (mode === "live") {
      const blockers = liveSendBlockers(f, g, rule.key).concat(rule.key === "live_first_session" && !f.live_campaign_enabled ? ["live_campaign_disabled"] : []);
      if (blockers.length) { await finish("cancelled", blockers[0]); continue; }
    }
    const u = userBy.get(job.userId);
    if (!u || u.isBlocked || u.role !== "USER") { await finish("suppressed", "user_unavailable"); continue; }
    const sup = suppressed.get(u.id) ?? new Set<string>();
    if (u.growthProfile?.unsubscribedAt) { await finish("suppressed", "unsubscribed"); continue; }
    if (sup.has("all")) { await finish("suppressed", "suppressed_all"); continue; }
    const ctx = ruleContext(u, facts.get(u.id)!, g, now);
    if (!rule.eligible(ctx)) { await finish("suppressed", "no_longer_eligible"); continue; }
    if (rule.kind === "promotional" && ctx.paid) { await finish("suppressed", "paid_customer"); continue; }
    if (mode === "live" && await prisma.growthMessage.findUnique({ where: { idempotencyKey: job.idempotencyKey }, select: { id: true } })) { await finish("suppressed", "already_sent"); continue; }

    const quiet = quietUntil(now, g.messaging.quietStartHour, g.messaging.quietEndHour);
    if (quiet) { await defer(quiet, "quiet_hours"); continue; }
    const history = mode === "live" ? historyLive : historyDry;
    const cap = capDecision(history.get(u.id) ?? [], now, f.caps);
    if (!cap.ok) { await defer(cap.retryAt, `frequency_cap_${cap.cap}`); continue; }

    let channel: Channel | null = chooseChannel({ channels: channelsFor(mode, f), hasEmail: !!u.email, marketingConsent: !!u.growthProfile?.marketingConsent, suppressed: sup });
    if (channel === "email" && mode === "live" && !adapters.emailConfigured()) channel = f.channels.in_app && !sup.has("in_app") ? "in_app" : null;
    if (!channel) { await finish("suppressed", "no_channel"); continue; }

    let msg: Message;
    try { const m = ruleMessage(rule, u, ctx); msg = { userId: u.id, type: `growth_${rule.key}`, title: m.title, body: m.body, link: m.link, lang: m.lang }; }
    catch { await finish("failed", "template_error", { channel }); continue; }

    if (job.variant === "holdout") { await finish("holdout", null, { channel }); continue; }
    if (mode === "dry_run") { history.set(u.id, [...(history.get(u.id) ?? []), now]); await finish("dry_run", null, { channel }); continue; }

    let emailDelivered = false;
    try {
      if (channel === "email") { await adapters.email(u.email!, msg); emailDelivered = true; }
      await prisma.$transaction(async tx => {
        const inApp = channel === "in_app" || f.channels.in_app ? await adapters.inApp(tx, msg, { push: f.channels.push && !sup.has("push") }) : null;
        await tx.growthMessage.create({ data: { userId: u.id, ruleKey: rule.key, channel: channel!, status: "sent", idempotencyKey: job.idempotencyKey } });
        await tx.followupJob.update({ where: { id: job.id }, data: { status: "sent", reason: null, channel: channel!, sentAt: now, processedAt: now, claimedAt: null, attempts: { increment: 1 }, notificationId: inApp?.notificationId ?? null } });
      });
      history.set(u.id, [...(history.get(u.id) ?? []), now]);
      count("sent");
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { await finish("suppressed", "already_sent"); continue; }
      // The email left already: never retry it (at most once); record it as sent.
      if (emailDelivered) {
        await prisma.growthMessage.create({ data: { userId: u.id, ruleKey: rule.key, channel: "email", status: "sent", idempotencyKey: job.idempotencyKey } }).catch(() => {});
        await finish("sent", "recorded_after_error", { channel: "email", sentAt: now, lastError: cleanError(e) });
        continue;
      }
      const attempts = job.attempts + 1;
      if (attempts >= job.maxAttempts) await finish("failed", "max_attempts", { attempts, lastError: cleanError(e) });
      else {
        await prisma.followupJob.update({ where: { id: job.id }, data: { status: "queued", attempts, lastError: cleanError(e), reason: "retry", nextAttemptAt: new Date(now.getTime() + backoffMinutes(attempts, f.retry) * 60_000), claimedAt: null } });
        count("retry_scheduled");
      }
    }
  }
  return result;
}

/** One scheduled cycle (hourly cron): plan, then process. Sends nothing while the engine is off. */
export async function runFollowupCycle(opts: { now?: Date; adapters?: Adapters } = {}) {
  const plan = await planFollowups({ now: opts.now });
  const processed = await processFollowups({ now: opts.now, adapters: opts.adapters });
  return { plan, processed };
}
