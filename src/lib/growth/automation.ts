import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/create";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { getGrowthSettings, type GrowthSettings } from "./config";
import { loadFacts } from "./facts";
import { daysSince, evaluate, isPaidActive, type CustomerFacts } from "./lifecycle";
import { growthModule, moduleEntry } from "./modules";

/** A module's page for a message link; home when the module is unknown. */
const entryOf = (id: string | null | undefined) => { const m = growthModule(id); return m ? moduleEntry(m) : "/home"; };
import { unsubscribeToken } from "./request";

export const TEMPLATE_VARIABLES = ["first_name", "preferred_module", "current_plan", "credit_balance", "recommended_next_step", "pricing_url"] as const;
type Vars = Record<typeof TEMPLATE_VARIABLES[number], string>;
export type Template = { titleFa: string; bodyFa: string; titleEn: string; bodyEn: string };

/** Throws on any {{variable}} outside the fixed list, so a typo can never reach a customer. */
export function validateTemplate(t: Template) {
  for (const text of Object.values(t)) for (const m of text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) if (!(TEMPLATE_VARIABLES as readonly string[]).includes(m[1])) throw new Error(`UNKNOWN_VARIABLE:${m[1]}`);
}

/** Plain-text rendering: values are stripped of markup/braces and length-capped; templates cannot read anything else. */
export function renderTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => {
    const v = (vars as Record<string, string>)[k];
    if (v === undefined) throw new Error(`UNKNOWN_VARIABLE:${k}`);
    return v.replace(/[<>{}]/g, "").slice(0, 80);
  });
}

type Ctx = { f: CustomerFacts; ev: ReturnType<typeof evaluate>; s: GrowthSettings; now: Date; intendedModule: string | null; ageDays: number; paid: boolean };
/** "guidance" helps the user succeed; "promotional" talks about plans and needs email consent for email. Promotional rules never target paying users. */
export type Rule = { key: string; kind: "guidance" | "promotional"; name: [string, string]; when: [string, string]; link: (c: Ctx) => string; eligible: (c: Ctx) => boolean; period?: (c: Ctx) => string; template: Template };

const hasFirstValue = (c: Ctx) => !!c.ev.firstValueAt;
export const RULES: Rule[] = [
  { key: "welcome", kind: "guidance", name: ["خوش‌آمد و شروع", "Welcome & start"], when: ["روز ۰، هنوز نتیجهٔ اول ندارد", "Day 0, no first result yet"], link: c => entryOf(c.intendedModule),
    eligible: c => c.ageDays < 1 && !hasFirstValue(c),
    template: { titleFa: "به AIFekr خوش آمدید، {{first_name}}", bodyFa: "برای شروع، {{recommended_next_step}}. فقط چند دقیقه طول می‌کشد.", titleEn: "Welcome to AIFekr, {{first_name}}", bodyEn: "To get started, {{recommended_next_step}}. It only takes a few minutes." } },
  { key: "getting_started_24h", kind: "guidance", name: ["راهنمای شروع (۲۴ ساعت)", "Getting started (24h)"], when: ["۱ تا ۳ روز بعد از ثبت‌نام، بدون نتیجهٔ اول", "1–3 days after signup, no first result"], link: c => entryOf(c.intendedModule),
    eligible: c => c.ageDays >= 1 && c.ageDays < 3 && !hasFirstValue(c),
    template: { titleFa: "اولین نتیجه‌تان را با {{preferred_module}} بگیرید", bodyFa: "پیشنهاد ما: {{recommended_next_step}}. اعتبار فعلی شما {{credit_balance}} کردیت است.", titleEn: "Get your first result with {{preferred_module}}", bodyEn: "Our suggestion: {{recommended_next_step}}. You currently have {{credit_balance}} credits." } },
  { key: "second_workflow_day3", kind: "guidance", name: ["کار دوم (روز ۳)", "Second workflow (day 3)"], when: ["نتیجهٔ اول دارد ولی برنگشته", "Has a first result but has not returned"], link: c => entryOf(c.intendedModule),
    eligible: c => c.ageDays >= 3 && hasFirstValue(c) && c.f.activeDaysWindow < 2 && !c.paid,
    template: { titleFa: "قدم بعدی با {{preferred_module}}", bodyFa: "{{recommended_next_step}} — از همان جایی که ماندید ادامه دهید.", titleEn: "Your next step with {{preferred_module}}", bodyEn: "{{recommended_next_step}} — pick up where you left off." } },
  { key: "paid_benefits_day5", kind: "promotional", name: ["مزایای پلن (روز ۵)", "Plan benefits (day 5)"], when: ["کاربر رایگانِ فعال", "Engaged free user"], link: () => "/pricing",
    eligible: c => c.ageDays >= 5 && !c.paid && c.ev.segments.includes("engaged_free"),
    template: { titleFa: "با AIFekr بیشتر بسازید", bodyFa: "از {{preferred_module}} زیاد استفاده کرده‌اید. پلن‌ها و کردیت هر کدام را در {{pricing_url}} ببینید.", titleEn: "Create more with AIFekr", bodyEn: "You've been using {{preferred_module}} a lot. See each plan and its credits at {{pricing_url}}." } },
  { key: "low_credit_day7", kind: "promotional", name: ["کردیت کم (روز ۷)", "Low credits (day 7)"], when: ["کردیت زیر آستانه، نتیجهٔ اول دارد", "Credits below threshold, has a first result"], link: () => "/pricing",
    eligible: c => c.ageDays >= 7 && !c.paid && hasFirstValue(c) && c.f.credits <= c.s.thresholds.lowCredits,
    template: { titleFa: "کردیت شما رو به پایان است", bodyFa: "اعتبار فعلی: {{credit_balance}} کردیت. گزینه‌های واقعی افزایش اعتبار و پلن‌ها: {{pricing_url}}", titleEn: "Your credits are running low", bodyEn: "Current balance: {{credit_balance}} credits. Real top-up and plan options: {{pricing_url}}" } },
  { key: "demo_offer_day10", kind: "promotional", name: ["پیشنهاد کمک شخصی (روز ۱۰)", "Personal help offer (day 10)"], when: ["امتیاز بالا و هنوز رایگان", "High score and still free"], link: () => "/contact",
    eligible: c => c.ageDays >= 10 && !c.paid && c.ev.score >= c.s.thresholds.highIntentScore,
    template: { titleFa: "می‌خواهید با هم بهترین مسیر را پیدا کنیم؟", bodyFa: "اگر برای کسب‌وکارتان راهنمایی می‌خواهید، به ما پیام دهید تا کمک کنیم.", titleEn: "Want help finding the best setup?", bodyEn: "If you'd like guidance for your business, send us a message and we'll help." } },
  { key: "feedback_day14", kind: "guidance", name: ["درخواست بازخورد (روز ۱۴)", "Feedback request (day 14)"], when: ["۱۴ روز بعد، هنوز خرید نکرده", "Day 14, has not purchased"], link: () => "/contact",
    eligible: c => c.ageDays >= 14 && c.ageDays < 30 && !c.paid,
    template: { titleFa: "نظر شما برای ما مهم است", bodyFa: "AIFekr چطور بود؟ اگر چیزی کم بود یا گیر کردید، کوتاه برایمان بنویسید (اختیاری).", titleEn: "We'd value your feedback", bodyEn: "How has AIFekr been? If something was missing or you got stuck, tell us briefly (optional)." } },
  { key: "voice_first_generation", kind: "guidance", name: ["استودیو صدا: اولین صدا", "Voice Studio: first audio"], when: ["از کمپین صدا آمده و هنوز صدا نساخته", "Came for Voice Studio, no audio yet"], link: () => "/voice-studio",
    eligible: c => c.intendedModule === "voice-studio" && c.ageDays >= 1 && c.ageDays < 7 && !c.f.successes["voice-studio"],
    template: { titleFa: "اولین صدای خود را بسازید", bodyFa: "یک جملهٔ کوتاه بنویسید، گوینده را انتخاب کنید و صدا بسازید. هزینه پیش از ساخت نمایش داده می‌شود.", titleEn: "Create your first voice", bodyEn: "Write a short sentence, pick a speaker and generate. The cost is shown before you create." } },
  { key: "inactive_return", kind: "guidance", name: ["بازگشت کاربر غیرفعال", "Inactive user return"], when: ["نتیجه داشته و مدتی برنگشته", "Had results, inactive for the configured days"], link: c => entryOf(Object.keys(c.f.successes)[0]),
    eligible: c => hasFirstValue(c) && daysSince(c.f.lastActiveAt, c.now) >= c.s.thresholds.inactiveDays, period: c => `${Math.floor(c.now.getTime() / (30 * 86_400_000))}`,
    template: { titleFa: "پروژه‌هایتان منتظر شماست", bodyFa: "کارهای ذخیره‌شده در {{preferred_module}} هنوز آن‌جاست. {{recommended_next_step}}.", titleEn: "Your projects are waiting", bodyEn: "Your saved work in {{preferred_module}} is still there. {{recommended_next_step}}." } },
  { key: "payment_failed", kind: "guidance", name: ["پرداخت ناموفق", "Payment failed"], when: ["پرداخت ناموفق در ۳ روز اخیر", "Failed payment in the last 3 days"], link: () => "/payments",
    eligible: c => !!c.f.payments.lastFailedAt && daysSince(c.f.payments.lastFailedAt, c.now) <= 3 && !c.paid, period: c => c.f.payments.lastFailedAt!.toISOString().slice(0, 10),
    template: { titleFa: "پرداخت شما کامل نشد", bodyFa: "اگر مبلغی کسر شده، طبق روال درگاه برگشت داده می‌شود. می‌توانید دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.", titleEn: "Your payment didn't complete", bodyEn: "If you were charged, the gateway returns it as usual. You can try again or contact support." } },
  { key: "post_purchase", kind: "guidance", name: ["شروع بعد از خرید", "Post-purchase onboarding"], when: ["خرید در ۳ روز اخیر", "Purchased in the last 3 days"], link: c => entryOf(c.intendedModule),
    eligible: c => c.paid && !!c.f.payments.firstPaidAt && daysSince(c.f.payments.firstPaidAt, c.now) <= 3,
    template: { titleFa: "پلن {{current_plan}} فعال است", bodyFa: "برای استفادهٔ کامل از پلن: {{recommended_next_step}}.", titleEn: "Your {{current_plan}} plan is active", bodyEn: "To get the most out of it: {{recommended_next_step}}." } },
  { key: "renewal_soon", kind: "guidance", name: ["تمدید نزدیک", "Renewal soon"], when: ["پایان پلن در روزهای تعیین‌شده", "Plan ends within the configured days"], link: () => "/plans",
    eligible: c => c.paid && !!c.f.planExpiry && c.f.planExpiry.getTime() - c.now.getTime() <= c.s.thresholds.renewalSoonDays * 86_400_000, period: c => c.f.planExpiry!.toISOString().slice(0, 10),
    template: { titleFa: "پلن شما به‌زودی تمام می‌شود", bodyFa: "پلن {{current_plan}} به‌زودی به پایان می‌رسد. برای ادامهٔ کار بدون وقفه می‌توانید تمدید کنید.", titleEn: "Your plan ends soon", bodyEn: "Your {{current_plan}} plan ends soon. You can renew to keep working without interruption." } },
];

/** Tehran wall-clock hour (UTC+3:30, no DST). */
export function tehranHour(now: Date) { return Math.floor(((now.getUTCHours() * 60 + now.getUTCMinutes() + 210) % 1440) / 60); }
export function inQuietHours(now: Date, start: number, end: number) { const h = tehranHour(now); return start === end ? false : start > end ? h >= start || h < end : h >= start && h < end; }

export type Suppression = "unsubscribed" | "frequency_cap" | "already_sent" | "paid_customer";

export type RuleResult = { key: string; kind: Rule["kind"]; enabled: boolean; eligible: number; wouldSend: number; suppressed: Record<string, number>; sample: { userId: string; name: string | null; channel: string; title: string }[]; sent: number; failed: number };

/**
 * Evaluates every rule at run time against current data. With dryRun (the
 * default and the admin preview) nothing is written or sent. A real run
 * sends only when BOTH lifecycle flags are on AND the rule was enabled by
 * an admin; each user/rule/period fires at most once (unique idempotency key).
 */
export async function runLifecycle(opts: { dryRun: boolean; now?: Date }): Promise<{ dryRun: boolean; quiet: boolean; blocked: string | null; results: RuleResult[] }> {
  const s = await getGrowthSettings(), now = opts.now ?? new Date();
  const live = !opts.dryRun && s.flags.lifecycle_automation_enabled && s.flags.automated_communications_enabled;
  const blocked = opts.dryRun ? null : !s.flags.lifecycle_automation_enabled ? "lifecycle_automation_disabled" : !s.flags.automated_communications_enabled ? "communications_disabled" : null;
  const quiet = inQuietHours(now, s.messaging.quietStartHour, s.messaging.quietEndHour);
  const users = await prisma.user.findMany({ where: { role: "USER", isBlocked: false }, select: { id: true, name: true, firstName: true, language: true, plan: true, credits: true, growthProfile: { select: { intendedModule: true, unsubscribedAt: true, marketingConsent: true } } }, take: 5000, orderBy: { createdAt: "desc" } });
  const facts = await loadFacts(users.map(u => u.id), s.thresholds.scoringWindowDays, now);
  const recent = await prisma.growthMessage.groupBy({ by: ["userId"], _count: { _all: true }, _max: { createdAt: true }, where: { status: "sent", createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } } });
  const recentBy = new Map(recent.map(r => [r.userId, r]));
  const sentKeys = new Set((await prisma.growthMessage.findMany({ where: { userId: { in: users.map(u => u.id) } }, select: { idempotencyKey: true } })).map(m => m.idempotencyKey));
  const results: RuleResult[] = [];
  const sentThisRun = new Set<string>();
  for (const rule of RULES) {
    const enabled = s.messaging.enabledRules.includes(rule.key);
    const r: RuleResult = { key: rule.key, kind: rule.kind, enabled, eligible: 0, wouldSend: 0, suppressed: {}, sample: [], sent: 0, failed: 0 };
    // A real run never evaluates switched-off rules, so they cannot use up a user's frequency budget.
    if (live && !enabled) { results.push(r); continue; }
    for (const u of users) {
      const f = facts.get(u.id)!, ev = evaluate(f, s, now);
      const ctx: Ctx = { f, ev, s, now, intendedModule: u.growthProfile?.intendedModule ?? null, ageDays: daysSince(f.createdAt, now), paid: isPaidActive(f, now) };
      if (!rule.eligible(ctx)) continue;
      r.eligible++;
      const key = `${rule.key}:${u.id}${rule.period ? `:${rule.period(ctx)}` : ""}`;
      const last = recentBy.get(u.id);
      const why: Suppression | null = u.growthProfile?.unsubscribedAt ? "unsubscribed" : sentKeys.has(key) ? "already_sent" : rule.kind === "promotional" && ctx.paid ? "paid_customer"
        : sentThisRun.has(u.id) || (last?._max.createdAt && now.getTime() - last._max.createdAt.getTime() < s.messaging.minHoursBetween * 3_600_000) || (last?._count._all ?? 0) >= s.messaging.maxPer14Days ? "frequency_cap" : null;
      if (why) { r.suppressed[why] = (r.suppressed[why] ?? 0) + 1; continue; }
      const email = !!u.growthProfile?.marketingConsent;
      const fa = (u.language || "fa") === "fa", tpl = s.messaging.templates[rule.key] ?? rule.template;
      const mod = growthModule(ctx.intendedModule ?? Object.keys(f.successes)[0]);
      const vars: Vars = { first_name: u.firstName || u.name?.split(" ")[0] || (fa ? "دوست عزیز" : "there"), preferred_module: mod ? mod.name[fa ? 0 : 1] : "AIFekr", current_plan: u.plan, credit_balance: String(u.credits), recommended_next_step: mod ? mod.exampleTask[fa ? 0 : 1] : fa ? "یک ابزار را امتحان کنید" : "try one tool", pricing_url: `${publicAppUrl()}/pricing` };
      let title: string, body: string;
      try { title = renderTemplate(fa ? tpl.titleFa : tpl.titleEn, vars); body = renderTemplate(fa ? tpl.bodyFa : tpl.bodyEn, vars); } catch { r.failed++; continue; }
      r.wouldSend++;
      sentThisRun.add(u.id);
      if (r.sample.length < 20) r.sample.push({ userId: u.id, name: u.name, channel: email ? "in_app+email" : "in_app", title });
      if (!live || quiet) continue;
      try {
        await prisma.growthMessage.create({ data: { userId: u.id, ruleKey: rule.key, channel: email ? "email" : "in_app", status: "sent", idempotencyKey: key } });
      } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { r.suppressed.already_sent = (r.suppressed.already_sent ?? 0) + 1; continue; } throw e; }
      const unsubscribe = `${publicAppUrl()}/api/growth/unsubscribe?u=${encodeURIComponent(u.id)}&t=${unsubscribeToken(u.id)}`;
      await notify(u.id, { type: `growth_${rule.key}`, title, body: email ? `${body}\n\n${fa ? "لغو دریافت پیام‌ها" : "Unsubscribe"}: ${unsubscribe}` : body, link: rule.link(ctx), email });
      r.sent++;
    }
    results.push(r);
  }
  return { dryRun: !live, quiet, blocked, results };
}
