import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { getGrowthSettings, saveGrowthSettings } from "@/lib/growth/config";
import { campaignReport, csvEscape, customerDetail, customerList, overview } from "@/lib/growth/analytics";
import { RULES, TEMPLATE_VARIABLES, runLifecycle, validateTemplate } from "@/lib/growth/automation";
import { GROWTH_MODULES } from "@/lib/growth/modules";
import { SEGMENTS } from "@/lib/growth/lifecycle";
import { safeInternalPath } from "@/lib/growth/attribution";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";

export const dynamic = "force-dynamic";

const day = (v: string | null, end = false) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00"}Z`) : null;

/** Customer Growth Center data. Admin only; CSV export is SUPER_ADMIN only and audited. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  const p = req.nextUrl.searchParams, view = p.get("view") || "overview";
  const settings = await getGrowthSettings();
  if (!settings.flags.customer_growth_enabled && view !== "settings") return NextResponse.json({ disabled: true });
  if (view === "overview") {
    const to = day(p.get("to"), true) ?? new Date(), from = day(p.get("from")) ?? new Date(to.getTime() - 30 * 86_400_000);
    if (from > to || to.getTime() - from.getTime() > 731 * 86_400_000) return NextResponse.json({ error: "INVALID_RANGE" }, { status: 400 });
    return NextResponse.json(await overview({ from, to }));
  }
  if (view === "campaigns") return NextResponse.json({ campaigns: await campaignReport(), modules: GROWTH_MODULES.map(m => ({ id: m.id, name: m.name, landingPath: m.landingPath })), origin: publicAppUrl() });
  if (view === "customers") {
    const stage = p.get("stage") || "", segment = p.get("segment") || "";
    return NextResponse.json(await customerList({ q: p.get("q")?.slice(0, 100) || "", stage: stage as never, segment: (SEGMENTS as readonly string[]).includes(segment) ? segment as never : "", band: p.get("band") || "", page: Number(p.get("page")) || 1 }));
  }
  if (view === "customer") {
    const id = p.get("id") || "";
    const detail = await customerDetail(id);
    return detail ? NextResponse.json(detail) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (view === "automations") {
    const preview = await runLifecycle({ dryRun: true });
    return NextResponse.json({ preview, rules: RULES.map(r => ({ key: r.key, kind: r.kind, name: r.name, when: r.when, template: settings.messaging.templates[r.key] ?? r.template, customised: !!settings.messaging.templates[r.key] })), variables: TEMPLATE_VARIABLES, messaging: settings.messaging, flags: settings.flags,
      history: await prisma.growthMessage.groupBy({ by: ["ruleKey", "status"], _count: { _all: true } }) });
  }
  if (view === "settings") return NextResponse.json({ settings });
  if (view === "export") {
    if (admin.role !== "SUPER_ADMIN") return forbiddenResponse(req);
    const list = await customerList({ q: p.get("q") || "", stage: (p.get("stage") || "") as never, segment: (p.get("segment") || "") as never, band: p.get("band") || "", page: 1 });
    const all = list.total > list.size ? await Promise.all(Array.from({ length: Math.ceil(list.total / list.size) }, (_, i) => customerList({ q: p.get("q") || "", stage: (p.get("stage") || "") as never, segment: (p.get("segment") || "") as never, band: p.get("band") || "", page: i + 1 }))) : [list];
    const rows = all.flatMap(l => l.rows);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "growth_customers_exported", metadata: JSON.stringify({ count: rows.length, filters: Object.fromEntries(p) }) } });
    const head = ["id", "name", "email", "phone", "createdAt", "plan", "credits", "source", "confidence", "stage", "score", "band", "segments", "lastActiveAt", "preferredModule", "followUpStatus"];
    const csv = [head.join(","), ...rows.map(r => [r.id, r.name, r.email, r.phone, r.createdAt, r.plan, r.credits, r.source, r.confidence, r.stage, r.score, r.band, r.segments.join("|"), r.lastActiveAt, r.preferredModule, r.followUpStatus].map(csvEscape).join(","))].join("\n");
    return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="aifekr-customers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "UNKNOWN_VIEW" }, { status: 400 });
}

const campaignSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(120),
  utmCampaign: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,80}$/),
  utmSource: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,60}$/),
  utmMedium: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,60}$/),
  targetModule: z.string().max(40).nullable().optional(),
  landingPath: z.string().max(200),
  status: z.enum(["draft", "active", "paused", "ended"]),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  spendToman: z.number().int().min(0).max(1e12).nullable().optional(),
  recommendedPlan: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).default(""),
});
const LANDING_OK = (path: string) => path === "/" || /^\/(features|solutions|guides)\/[a-z0-9-]+$/.test(path) || path === "/pricing" || path === "/fit" || !!safeInternalPath(path);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return forbiddenResponse(req);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const audit = (a: string, targetId: string | null, metadata: unknown) => prisma.auditLog.create({ data: { actorId: admin.id, action: a, targetId, metadata: JSON.stringify(metadata) } });
  try {
    if (action === "saveSettings") {
      const next = body.settings;
      for (const t of Object.values((next?.messaging?.templates ?? {}) as Record<string, never>)) validateTemplate(t);
      // Turning on live messaging is a SUPER_ADMIN decision.
      const current = await getGrowthSettings();
      const turningOn = (k: "lifecycle_automation_enabled" | "automated_communications_enabled") => next?.flags?.[k] === true && !current.flags[k];
      if ((turningOn("lifecycle_automation_enabled") || turningOn("automated_communications_enabled")) && admin.role !== "SUPER_ADMIN") return forbiddenResponse(req);
      return NextResponse.json({ settings: await saveGrowthSettings(next, admin.id) });
    }
    if (action === "saveCampaign") {
      const c = campaignSchema.parse(body.campaign);
      if (!LANDING_OK(c.landingPath)) return NextResponse.json({ error: "INVALID_LANDING_PATH" }, { status: 400 });
      if (c.targetModule && !GROWTH_MODULES.some(m => m.id === c.targetModule)) return NextResponse.json({ error: "UNKNOWN_MODULE" }, { status: 400 });
      if (c.recommendedPlan && !(await prisma.package.findUnique({ where: { planCode: c.recommendedPlan }, select: { id: true } }))) return NextResponse.json({ error: "UNKNOWN_PLAN" }, { status: 400 });
      const data = { name: c.name, utmCampaign: c.utmCampaign, utmSource: c.utmSource, utmMedium: c.utmMedium, targetModule: c.targetModule || null, landingPath: c.landingPath, status: c.status, startsAt: c.startsAt ? new Date(c.startsAt) : null, endsAt: c.endsAt ? new Date(c.endsAt) : null, spendToman: c.spendToman ?? null, recommendedPlan: c.recommendedPlan || null, notes: c.notes };
      const saved = c.id ? await prisma.growthCampaign.update({ where: { id: c.id }, data }) : await prisma.growthCampaign.create({ data: { ...data, createdById: admin.id } });
      // Touches recorded before the campaign existed are linked by utm_campaign.
      await prisma.growthTouch.updateMany({ where: { utmCampaign: saved.utmCampaign, campaignId: null }, data: { campaignId: saved.id } });
      await audit("growth_campaign_saved", saved.id, data);
      return NextResponse.json({ campaign: saved });
    }
    if (action === "addNote") {
      const { userId, text } = z.object({ userId: z.string().max(40), text: z.string().trim().min(1).max(2000) }).parse(body);
      const note = await prisma.growthNote.create({ data: { userId, authorId: admin.id, body: text } });
      await audit("growth_note_added", userId, { noteId: note.id });
      return NextResponse.json({ note });
    }
    if (action === "followUp") {
      const { userId, status, assign } = z.object({ userId: z.string().max(40), status: z.enum(["none", "open", "contacted", "resolved"]), assign: z.boolean().optional() }).parse(body);
      await prisma.growthProfile.upsert({ where: { userId }, create: { userId, followUpStatus: status, assignedAdminId: assign ? admin.id : null }, update: { followUpStatus: status, ...(assign ? { assignedAdminId: admin.id } : {}) } });
      await audit("growth_follow_up", userId, { status, assign });
      return NextResponse.json({ ok: true });
    }
    if (action === "stopMessages") {
      // Admins can only suppress messages for a customer, never grant consent on their behalf.
      const { userId } = z.object({ userId: z.string().max(40) }).parse(body);
      await prisma.growthProfile.upsert({ where: { userId }, create: { userId, unsubscribedAt: new Date(), marketingConsent: false, consentSource: "admin_stop" }, update: { unsubscribedAt: new Date(), marketingConsent: false, consentSource: "admin_stop" } });
      await audit("growth_messages_stopped", userId, {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: e.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
    if (e instanceof Error && /^(UNKNOWN_VARIABLE|INVALID_SCORE_BANDS)/.test(e.message)) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") return NextResponse.json({ error: "DUPLICATE_UTM_CAMPAIGN" }, { status: 409 });
    throw e;
  }
}
