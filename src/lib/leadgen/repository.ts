import { prisma } from "@/lib/db/prisma";
import { createHash, randomBytes } from "crypto";
import { scoreLead } from "./score";
import { parseFields, LEAD_FIELD_KEYS, type LeadFieldKey } from "./fields";
import { bizScope } from "@/lib/accounting/scope";

/** URL-safe slug from a title + a short random suffix to guarantee uniqueness. */
export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    // ASCII letters/digits only in the readable part; everything else
    // (spaces, punctuation, non-Latin script) collapses to a hyphen. The
    // random suffix below is what actually guarantees uniqueness, so a
    // title that's entirely non-Latin just yields an all-suffix slug.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : suffix;
}

export function hashIp(ip: string): string {
  const salt = process.env.LEAD_IP_SALT || process.env.JWT_SECRET || "aifekr";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export interface SubmitInput {
  values: Partial<Record<LeadFieldKey, string>>;
  utm: { source?: string; medium?: string; campaign?: string };
  ipHash: string | null;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  redirectUrl?: string | null;
  successMessage?: string | null;
}

/**
 * Validates a public submission against the form's field config, then creates
 * the tenant's CrmContact + LeadFormSubmission + a CrmActivity note in one
 * transaction. The contact lands as status "lead", source "lead_form", so the
 * existing lead-followup-sequence cron picks it up automatically.
 */
export async function submitLeadForm(slug: string, input: SubmitInput): Promise<SubmitResult> {
  const form = await prisma.leadForm.findUnique({ where: { slug } });
  if (!form || !form.isActive) return { ok: false, error: "form_not_found" };

  const cfg = parseFields(form.fields);
  const v: Partial<Record<LeadFieldKey, string>> = {};
  for (const key of LEAD_FIELD_KEYS) {
    const raw = (input.values[key] ?? "").toString().trim().slice(0, 2000);
    if (cfg[key].show && cfg[key].required && !raw) {
      return { ok: false, error: `missing_${key}` };
    }
    if (raw) v[key] = raw;
  }
  if (!v.name) return { ok: false, error: "missing_name" };

  const score = scoreLead({
    name: v.name,
    phone: v.phone,
    email: v.email,
    company: v.company,
    message: v.message,
    utmCampaign: input.utm.campaign,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.crmContact.create({
        data: {
          userId: form.userId,
          businessId: form.businessId,
          name: v.name!,
          phone: v.phone || undefined,
          email: v.email || undefined,
          company: v.company || undefined,
          status: "lead",
          source: "lead_form",
          sourceDetails: JSON.stringify({
            formId: form.id,
            formTitle: form.title,
            slug: form.slug,
            score,
            utm: input.utm,
          }),
          tags: "فرم لید",
          notes: v.message || undefined,
        },
      });

      await tx.leadFormSubmission.create({
        data: {
          formId: form.id,
          contactId: c.id,
          data: JSON.stringify(v),
          score,
          utmSource: input.utm.source || undefined,
          utmMedium: input.utm.medium || undefined,
          utmCampaign: input.utm.campaign || undefined,
          ipHash: input.ipHash || undefined,
        },
      });

      await tx.crmActivity.create({
        data: {
          userId: form.userId,
          businessId: form.businessId,
          contactId: c.id,
          type: "note",
          content: `لید جدید از فرم «${form.title}» (امتیاز ${score}/100)${input.utm.campaign ? ` — کمپین: ${input.utm.campaign}` : ""}`,
        },
      });

      return c;
    });

    // contact id intentionally not returned to the public caller
    return { ok: true, redirectUrl: form.redirectUrl, successMessage: form.successMessage };
  } catch {
    // Still record the raw submission so nothing is lost, even if the
    // contact write failed (e.g. transient DB error).
    await prisma.leadFormSubmission
      .create({ data: { formId: form.id, data: JSON.stringify(v), score, ipHash: input.ipHash || undefined } })
      .catch(() => {});
    return { ok: false, error: "server_error" };
  }
}

export interface ExternalLeadInput {
  userId: string;
  /** CrmContact.source value, e.g. "meta_lead_ads" | "google_ads". */
  source: string;
  /** Human label for the activity note, e.g. the Page name or campaign. */
  sourceName: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  message?: string | null;
  /** Business the connector belongs to; the lead lands in that business's CRM. */
  businessId?: string | null;
  /** Opaque provider id (Meta leadgen_id / Google lead_id) for dedupe. */
  externalRef?: string | null;
  utm?: { source?: string; medium?: string; campaign?: string };
}

/**
 * Shared ingestion path for leads arriving from an external channel
 * connector (Meta Lead Ads, Google Ads). Mirrors submitLeadForm: creates a
 * CrmContact (status "lead"), scores it, logs an activity — so the existing
 * lead-followup-sequence cron and the channel report pick these up with no
 * extra wiring. De-dupes on externalRef stored in sourceDetails.
 */
export async function ingestExternalLead(input: ExternalLeadInput): Promise<{ ok: boolean; deduped?: boolean; contactId?: string }> {
  const name = (input.name || "").trim() || "بدون نام";

  if (input.externalRef) {
    const dup = await prisma.crmContact.findFirst({
      where: { userId: input.userId, source: input.source, sourceDetails: { contains: `"externalRef":"${input.externalRef}"` } },
      select: { id: true },
    });
    if (dup) return { ok: true, deduped: true, contactId: dup.id };
  }

  const score = scoreLead({
    name,
    phone: input.phone,
    email: input.email,
    company: input.company,
    message: input.message,
    utmCampaign: input.utm?.campaign,
  });

  const contact = await prisma.$transaction(async (tx) => {
    const c = await tx.crmContact.create({
      data: {
        userId: input.userId,
        businessId: input.businessId ?? undefined,
        name,
        phone: input.phone?.trim() || undefined,
        email: input.email?.trim() || undefined,
        company: input.company?.trim() || undefined,
        status: "lead",
        source: input.source,
        sourceDetails: JSON.stringify({
          channel: input.sourceName,
          score,
          externalRef: input.externalRef || null,
          utm: input.utm || {},
        }),
        tags: input.source === "meta_lead_ads" ? "لید Meta" : input.source === "google_ads" ? "لید Google" : "لید تبلیغات",
        notes: input.message?.trim() || undefined,
      },
    });
    await tx.crmActivity.create({
      data: {
        userId: input.userId,
        businessId: input.businessId ?? undefined,
        contactId: c.id,
        type: "note",
        content: `لید جدید از ${input.sourceName} (امتیاز ${score}/100)${input.utm?.campaign ? ` — کمپین: ${input.utm.campaign}` : ""}`,
      },
    });
    return c;
  });

  return { ok: true, contactId: contact.id };
}

/** Per-channel conversion for a tenant: leads grouped by CrmContact.source. */
export async function channelReport(userId: string, businessId?: string | null) {
  const rows = await prisma.crmContact.groupBy({
    by: ["source", "status"],
    where: { userId, ...bizScope(businessId) },
    _count: { _all: true },
  });

  const bySource = new Map<string, { total: number; qualified: number; customer: number }>();
  for (const r of rows) {
    const key = r.source || "organic";
    const cur = bySource.get(key) || { total: 0, qualified: 0, customer: 0 };
    cur.total += r._count._all;
    if (r.status === "qualified") cur.qualified += r._count._all;
    if (r.status === "customer") cur.customer += r._count._all;
    bySource.set(key, cur);
  }

  return Array.from(bySource.entries())
    .map(([source, s]) => ({
      source,
      total: s.total,
      qualified: s.qualified,
      customer: s.customer,
      conversionRate: s.total > 0 ? Math.round((s.customer / s.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
