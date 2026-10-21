export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { metaFetchLead, mapMetaFields } from "@/lib/leadgen/meta";
import { ingestExternalLead } from "@/lib/leadgen/repository";

// Meta Lead Ads webhook. The one-time verification handshake (GET) and the
// per-lead notifications (POST). The notification only carries a leadgen_id +
// page_id; the actual answers are fetched from Graph (via the relay) using
// the stored Page token for that LeadSource.
const VERIFY_TOKEN =
  process.env.META_LEADS_WEBHOOK_VERIFY_TOKEN || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === VERIFY_TOKEN &&
    searchParams.get("hub.challenge")
  ) {
    return new NextResponse(searchParams.get("hub.challenge"), { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET || "";
  if (!secret || !header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

interface LeadgenChange {
  field: string;
  value?: { leadgen_id?: string; page_id?: string; form_id?: string; ad_id?: string; created_time?: number };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: { object?: string; entry?: Array<{ id: string; changes?: LeadgenChange[] }> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed, nothing to do
  }

  // Meta wants a fast 200; at this scale (handful of connected pages) the
  // Graph fetch + insert per lead is cheap enough to run inline.
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen" || !change.value?.leadgen_id) continue;
      const pageId = change.value.page_id || entry.id;
      const leadgenId = change.value.leadgen_id;

      try {
        const source = await prisma.leadSource.findFirst({ where: { provider: "meta", externalId: pageId } });
        if (!source || !source.accessToken) continue;

        const lead = await metaFetchLead(leadgenId, source.accessToken);
        const mapped = mapMetaFields(lead.fieldData);

        await ingestExternalLead({
          userId: source.userId,
          businessId: source.businessId,
          source: "meta_lead_ads",
          sourceName: `Meta Lead Ads — ${source.name}`,
          ...mapped,
          externalRef: leadgenId,
          utm: { source: "meta", medium: "lead_ad", campaign: lead.campaignName },
        });

        await prisma.leadSource.update({
          where: { id: source.id },
          data: { lastLeadAt: new Date(), leadsImported: { increment: 1 }, status: "active", lastError: null },
        });
      } catch (e) {
        console.error("meta-leads webhook: failed to ingest", leadgenId, e);
        await prisma.leadSource
          .updateMany({ where: { provider: "meta", externalId: pageId }, data: { status: "error", lastError: e instanceof Error ? e.message : "lead fetch failed" } })
          .catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
