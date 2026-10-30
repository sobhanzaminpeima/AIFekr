import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getServerLang } from "@/lib/i18n/server";
import { homePayload } from "@/lib/home/homePayload";
import { homeView } from "@/lib/home/homeView";

export const dynamic = "force-dynamic";

/** The home page for the new design: the classic page's data, figures and wording, ready to render. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  return NextResponse.json(homeView(await homePayload(user), await getServerLang()), { headers: { "Cache-Control": "no-store" } });
}
