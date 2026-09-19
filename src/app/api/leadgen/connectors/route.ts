export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

// Lists the tenant's connected lead channels, and (POST) provisions the
// Google Ads webhook connector — which needs no OAuth, just a per-tenant key.

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const sources = await prisma.leadSource.findMany({
    where: { userId: user.id, ...bizScope(businessId) },
    orderBy: { createdAt: "desc" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  return NextResponse.json({
    connectors: sources.map((s) => ({
      id: s.id,
      provider: s.provider,
      name: s.name,
      status: s.status,
      lastError: s.lastError,
      lastLeadAt: s.lastLeadAt,
      leadsImported: s.leadsImported,
      // Only Google needs these surfaced (Meta's token stays server-side).
      webhookUrl: s.provider === "google" ? `${appUrl}/api/leadgen/connectors/google/webhook` : null,
      webhookKey: s.provider === "google" ? s.webhookKey : null,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const body = await req.json().catch(() => ({}));
  if (body.provider !== "google") {
    return NextResponse.json({ error: "provider نامعتبر" }, { status: 400 });
  }

  // One Google connector per tenant; regenerate the key on repeat calls.
  const key = randomBytes(24).toString("hex");
  const src = await prisma.leadSource.upsert({
    where: { userId_provider_externalId: { userId: user.id, provider: "google", externalId: "default" } },
    update: { webhookKey: key, status: "active", lastError: null },
    create: { userId: user.id, businessId: await activeBusinessIdFor(user.id), provider: "google", externalId: "default", name: "Google Ads", webhookKey: key, status: "active" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  return NextResponse.json({
    id: src.id,
    webhookUrl: `${appUrl}/api/leadgen/connectors/google/webhook`,
    webhookKey: key,
  });
}
