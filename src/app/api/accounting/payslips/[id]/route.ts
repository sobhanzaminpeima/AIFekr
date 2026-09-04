export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { updatePayslip } from "@/lib/accounting/payroll";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Adjusts bonus/deductions on a payslip whose run is still a draft. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { bonus, deductions } = (await req.json()) as { bonus?: number; deductions?: number };
  try {
    const payslip = await updatePayslip(params.id, ws.workspaceUserId, bonus, deductions);
    return NextResponse.json({ payslip });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در به‌روزرسانی فیش حقوقی", "Failed to update payslip", "Fehler beim Aktualisieren der Gehaltsabrechnung") }, { status: 400 });
  }
}
