export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { rateLimit } from "@/lib/utils/rateLimit";
import { getSeoAccountRates } from "@/lib/seo/intelligence/accountPricing";
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req); if (!admin) return unauthorizedResponse(req);
  if (!rateLimit(`seo-account-rates:${admin.id}`, 3, 60000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
  try { return NextResponse.json(await getSeoAccountRates()); }
  catch { return NextResponse.json({ code: "ACCOUNT_PRICING_UNAVAILABLE" }, { status: 503 }); }
}
