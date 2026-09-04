export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { upsertEmployee } from "@/lib/accounting/payroll";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const body = await req.json();
  const { name, userId, baseSalary, isActive } = body as { name?: string; userId?: string | null; baseSalary?: number; isActive?: boolean };

  try {
    const employee = await upsertEmployee({ workspaceUserId: ws.workspaceUserId, id: params.id, name, userId, baseSalary, isActive });
    return NextResponse.json({ employee });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در به‌روزرسانی کارمند", "Failed to update employee", "Fehler beim Aktualisieren des Mitarbeiters") }, { status: 400 });
  }
}
