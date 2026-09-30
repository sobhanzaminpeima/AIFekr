export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, getClientIp } from "@/lib/utils/rateLimit";
import { looksLikeInjectionAttempt } from "@/lib/ai/promptSafety";
import { parseFields, LEAD_FIELD_KEYS, FIELD_LABELS } from "@/lib/leadgen/fields";
import { submitLeadForm, hashIp } from "@/lib/leadgen/repository";

// Public, unauthenticated. GET returns the form's render config; POST accepts
// one submission. Both are per-IP rate-limited; POST also has a honeypot.

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const form = await prisma.leadForm.findUnique({ where: { slug: params.slug } });
  if (!form || !form.isActive) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    slug: form.slug,
    title: form.title,
    titleEn: form.titleEn,
    titleDe: form.titleDe,
    description: form.description,
    descriptionEn: form.descriptionEn,
    descriptionDe: form.descriptionDe,
    fields: parseFields(form.fields),
    fieldLabels: FIELD_LABELS,
    accentColor: form.accentColor,
    logoUrl: form.logoUrl,
    submitLabel: form.submitLabel,
  });
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`leadform:${params.slug}:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "too_many" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Honeypot: a hidden field real users never fill.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }); // silently accept-and-drop
  }

  const values: Partial<Record<(typeof LEAD_FIELD_KEYS)[number], string>> = {};
  for (const key of LEAD_FIELD_KEYS) {
    const raw = body[key];
    if (typeof raw === "string") values[key] = raw;
  }
  if ((values.name && looksLikeInjectionAttempt(values.name)) || (values.message && looksLikeInjectionAttempt(values.message))) {
    return NextResponse.json({ error: "invalid_content" }, { status: 400 });
  }

  const result = await submitLeadForm(params.slug, {
    values,
    utm: {
      source: typeof body.utm_source === "string" ? body.utm_source.slice(0, 120) : undefined,
      medium: typeof body.utm_medium === "string" ? body.utm_medium.slice(0, 120) : undefined,
      campaign: typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 120) : undefined,
    },
    ipHash: ip && ip !== "unknown" ? hashIp(ip) : null,
  });

  if (!result.ok) {
    const status = result.error === "form_not_found" ? 404 : result.error === "server_error" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, redirectUrl: result.redirectUrl, successMessage: result.successMessage });
}
