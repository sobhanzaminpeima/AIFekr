export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { PROVIDERS, streamOpenAICompat } from "@/lib/ai/providers";
import { evaluateWithTypeSafe, isTypeSafeConfigured } from "@/lib/ai/typesafe";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider");

  if (providerId === "typesafe-jev") {
    if (!isTypeSafeConfigured) return NextResponse.json({ ok: false, error: "API key not configured" });
    try {
      const result = await evaluateWithTypeSafe("The customer says: I need help with my payment immediately.", {
        urgency: { type: "noul", instructions: "Does this message express urgency?" },
      });
      return NextResponse.json({ ok: true, response: JSON.stringify(result.answers).slice(0, 100) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: msg.slice(0, 200) });
    }
  }

  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });

  if (!provider.apiKey || provider.apiKey.length < 10) {
    return NextResponse.json({ ok: false, error: "API key not configured" });
  }

  const testMessages = [{ role: "user" as const, content: "Say: OK" }];

  try {
    let got = "";
    await streamOpenAICompat(provider, testMessages, "You are a test assistant. Reply with just: OK", (t) => { got += t; });
    return NextResponse.json({ ok: true, response: got.slice(0, 100) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) });
  }
}
