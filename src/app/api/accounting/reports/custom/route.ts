export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { runCustomReport } from "@/lib/accounting/reports";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/** { accountCodes: string[], from, to } — accountCodes empty/omitted means all accounts. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const { accountCodes, from, to } = (await req.json()) as { accountCodes?: string[]; from?: string; to?: string };
  if (!from || !to) return NextResponse.json({ error: tri(lang, "بازه زمانی الزامی است", "A date range is required", "Ein Datumsbereich ist erforderlich") }, { status: 400 });

  const rows = await runCustomReport(ws.workspaceUserId, accountCodes || [], new Date(from), new Date(to));
  return NextResponse.json({ rows });
}
