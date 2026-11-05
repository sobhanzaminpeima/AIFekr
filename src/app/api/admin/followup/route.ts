import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { getFollowupSettings, saveFollowupSettings } from "@/lib/followup/settings";
import { conversionReport, engineOverview, jobList } from "@/lib/followup/analytics";
import { planFollowups, processFollowups } from "@/lib/followup/engine";
import { ensureLiveGrowthCampaign, liveCampaignFunnel, liveCampaignStatus } from "@/lib/followup/liveCampaign";

export const dynamic = "force-dynamic";

const day = (v: string | null, end = false) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00"}Z`) : null;

/** Customer Follow-up & Conversion: engine state, job logs, conversion analytics and the Live campaign. Admin only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  const p = req.nextUrl.searchParams, view = p.get("view") || "engine";
  if (view === "engine") return NextResponse.json(await engineOverview());
  if (view === "jobs") return NextResponse.json(await jobList({ status: p.get("status")?.slice(0, 20) || "", rule: p.get("rule")?.slice(0, 60) || "", mode: p.get("mode")?.slice(0, 10) || "", userId: p.get("userId")?.slice(0, 40) || "", page: Number(p.get("page")) || 1 }));
  if (view === "analytics") {
    const to = day(p.get("to"), true) ?? new Date(), from = day(p.get("from")) ?? new Date(to.getTime() - 30 * 86_400_000);
    if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) return NextResponse.json({ error: "INVALID_RANGE" }, { status: 400 });
    return NextResponse.json({ range: { from, to }, windowDays: (await getFollowupSettings()).conversionWindowDays, rules: await conversionReport({ from, to }) });
  }
  if (view === "live") {
    const [status, funnel, settings] = await Promise.all([liveCampaignStatus(), liveCampaignFunnel(), getFollowupSettings()]);
    return NextResponse.json({ status, funnel, enabled: settings.live_campaign_enabled });
  }
  return NextResponse.json({ error: "UNKNOWN_VIEW" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const audit = (a: string, targetId: string | null, metadata: unknown) => prisma.auditLog.create({ data: { actorId: admin.id, action: a, targetId, metadata: JSON.stringify(metadata) } });
  try {
    if (action === "saveSettings") return NextResponse.json({ settings: await saveFollowupSettings(body.settings, admin) });
    if (action === "runNow") {
      // A manual run in live mode can send real messages, so it is a SUPER_ADMIN action.
      const s = await getFollowupSettings();
      if (s.mode === "live" && admin.role !== "SUPER_ADMIN") return forbiddenResponse(req);
      const plan = await planFollowups(), processed = await processFollowups();
      await audit("followup_run_now", null, { plan, processed });
      return NextResponse.json({ plan, processed });
    }
    if (action === "cancelQueued") {
      const { rule } = z.object({ rule: z.string().max(60).optional() }).parse(body);
      const r = await prisma.followupJob.updateMany({ where: { status: "queued", ...(rule ? { ruleKey: rule } : {}) }, data: { status: "cancelled", reason: "admin_cancelled", processedAt: new Date() } });
      await audit("followup_jobs_cancelled", null, { rule: rule ?? null, count: r.count });
      return NextResponse.json({ cancelled: r.count });
    }
    if (action === "suppress" || action === "unsuppress") {
      const { userId, channel } = z.object({ userId: z.string().max(40), channel: z.enum(["all", "in_app", "email", "push"]) }).parse(body);
      if (action === "suppress") await prisma.followupSuppression.upsert({ where: { userId_channel: { userId, channel } }, create: { userId, channel, reason: "admin", source: "admin", actorId: admin.id }, update: {} });
      // Lifting a suppression never grants marketing consent; it only removes the admin block.
      else await prisma.followupSuppression.deleteMany({ where: { userId, channel, source: "admin" } });
      await audit(`followup_${action}`, userId, { channel });
      return NextResponse.json({ ok: true });
    }
    if (action === "ensureLiveCampaign") return NextResponse.json({ campaign: await ensureLiveGrowthCampaign(admin.id) });
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: e.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
    if (e instanceof Error && e.message === "SUPER_ADMIN_REQUIRED") return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof Error && e.message === "INVALID_CAPS") return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
