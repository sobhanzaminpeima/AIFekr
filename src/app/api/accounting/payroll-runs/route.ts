export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { generatePayrollRun } from "@/lib/accounting/payroll";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const runs = await prisma.accountingPayrollRun.findMany({
    where: { workspaceUserId: ws.workspaceUserId },
    include: { payslips: { include: { employee: true } } },
    orderBy: { period: "desc" },
  });
  return NextResponse.json({ runs });
}

/** Generates (or, while still draft, regenerates) the payroll run for a month. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { period } = (await req.json()) as { period?: string };
  if (!period) return NextResponse.json({ error: tri(lang, "ماه الزامی است", "Period is required", "Zeitraum ist erforderlich") }, { status: 400 });

  try {
    await ensureDefaultChartOfAccounts(ws.workspaceUserId);
    const run = await generatePayrollRun(ws.workspaceUserId, new Date(period));
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت لیست حقوق", "Failed to generate payroll run", "Fehler beim Erstellen der Gehaltsabrechnung") }, { status: 400 });
  }
}
