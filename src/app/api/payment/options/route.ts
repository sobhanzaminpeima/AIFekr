export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getServerLang } from "@/lib/i18n/server";
import { paymentOptions } from "@/lib/payment/routing";

/** The signed-in buyer's payment routes (currencies and gateways) and the preferred one (lib/payment/routing). */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json(await paymentOptions(user.id, await getServerLang()), { headers: { "Cache-Control": "no-store" } });
}
