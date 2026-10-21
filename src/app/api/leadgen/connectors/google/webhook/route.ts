export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ingestExternalLead } from "@/lib/leadgen/repository";

// Google Ads lead-form webhook. Unlike Meta, Google POSTs the full lead here
// — no follow-up API call, so this works with no outbound network and no
// OAuth. The tenant pastes this URL + their key into the lead form's
// "Lead delivery" settings in Google Ads; `google_key` in the body
// authenticates and identifies which tenant's LeadSource it belongs to.
interface GoogleColumn {
  column_id?: string;
  column_name?: string;
  string_value?: string;
}
interface GooglePayload {
  lead_id?: string;
  google_key?: string;
  campaign_id?: string | number;
  form_id?: string | number;
  is_test?: boolean;
  user_column_data?: GoogleColumn[];
}

function pick(cols: GoogleColumn[], ...ids: string[]): string | undefined {
  for (const c of cols) {
    const id = (c.column_id || "").toUpperCase();
    const name = (c.column_name || "").toLowerCase();
    if (ids.some((k) => id === k || id.includes(k) || name.includes(k.toLowerCase()))) {
      if (c.string_value) return c.string_value;
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as GooglePayload | null;
  if (!body || !body.google_key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }

  const source = await prisma.leadSource.findFirst({
    where: { provider: "google", webhookKey: body.google_key },
  });
  if (!source) return NextResponse.json({ error: "unknown key" }, { status: 403 });

  // Google sends a test lead when the advertiser clicks "Send test data" —
  // acknowledge it so their UI shows success, but don't create a contact.
  if (body.is_test) return NextResponse.json({ ok: true, test: true });

  const cols = body.user_column_data || [];
  const first = pick(cols, "FIRST_NAME");
  const last = pick(cols, "LAST_NAME");
  const full = pick(cols, "FULL_NAME", "NAME");

  try {
    await ingestExternalLead({
      userId: source.userId,
      businessId: source.businessId,
      source: "google_ads",
      sourceName: "Google Ads",
      name: full || [first, last].filter(Boolean).join(" ") || undefined,
      phone: pick(cols, "PHONE_NUMBER", "PHONE"),
      email: pick(cols, "EMAIL"),
      company: pick(cols, "COMPANY_NAME", "COMPANY"),
      message: pick(cols, "MESSAGE", "COMMENTS", "QUESTION"),
      externalRef: body.lead_id ? String(body.lead_id) : null,
      utm: { source: "google", medium: "lead_form", campaign: body.campaign_id ? String(body.campaign_id) : undefined },
    });

    await prisma.leadSource.update({
      where: { id: source.id },
      data: { lastLeadAt: new Date(), leadsImported: { increment: 1 }, status: "active", lastError: null },
    });
  } catch (e) {
    console.error("google leads webhook: ingest failed", e);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
