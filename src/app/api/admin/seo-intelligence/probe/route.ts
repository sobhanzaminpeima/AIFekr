export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { getSeoProviderConfig, providerAuthorization } from "@/lib/seo/intelligence/config";
import { rateLimit } from "@/lib/utils/rateLimit";
import { readSeoJson } from "@/lib/seo/intelligence/response";
import { z } from "zod";
/** Account health uses the read-only appendix endpoint, never a paid task. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req); if (!admin) return unauthorizedResponse(req);
  if (!rateLimit(`seo-provider-probe:${admin.id}`, 3, 60000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
  try {
    const response = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: providerAuthorization(await getSeoProviderConfig()) }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error();
    z.object({ status_code: z.literal(20000), tasks: z.array(z.object({ status_code: z.literal(20000) })).length(1) }).parse(await readSeoJson(response));
    return NextResponse.json({ status: "AUTHENTICATED" });
  } catch { return NextResponse.json({ code: "PROVIDER_CONNECTION_FAILED" }, { status: 422 }); }
}
