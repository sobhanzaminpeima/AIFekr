export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { PROVIDERS } from "@/lib/ai/providers";
import { getDisabledProviders, refreshDisabledProviders, setProviderEnabled } from "@/lib/ai/providerConfig";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse();
  }
  // The admin page used to keep its own hardcoded provider list -- eight
  // entries frozen at whatever the router looked like the day that page was
  // written, missing Claude, Groq, Cohere and every Mistral-family model that
  // real users actually see in the chat model picker (13 of them, added
  // later straight into src/lib/ai/providers.ts). Sourcing from PROVIDERS
  // here means this list can't drift from what's actually live again.
  const providers = PROVIDERS.map((p) => ({
    id: p.id, name: p.name, provider: p.provider, model: p.model, strengths: p.strengths,
    maxTokens: p.maxTokens, creditCost: p.creditCost, configured: p.apiKey.length > 10,
  }));
  await refreshDisabledProviders();
  return NextResponse.json({ disabled: Array.from(getDisabledProviders()), providers });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse();
  }

  const { providerId, enabled } = await req.json();
  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing providerId" }, { status: 400 });
  }
  if (!PROVIDERS.some((p) => p.id === providerId)) {
    return NextResponse.json({ ok: false, error: "Unknown providerId" }, { status: 400 });
  }

  const disabled = await setProviderEnabled(providerId, Boolean(enabled));
  return NextResponse.json({ ok: true, disabled });
}
