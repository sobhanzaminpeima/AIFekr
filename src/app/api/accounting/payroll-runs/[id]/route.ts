export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { approvePayrollRun, payPayrollRun } from "@/lib/accounting/payroll";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const run = await prisma.accountingPayrollRun.findFirst({
    where: { id: params.id, workspaceUserId: ws.workspaceUserId },
    include: { payslips: { include: { employee: true } } },
  });
  if (!run) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });
  return NextResponse.json({ run });
}

/** { action: "approve" | "pay" } */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const run = await prisma.accountingPayrollRun.findFirst({ where: { id: params.id, workspaceUserId: ws.workspaceUserId } });
  if (!run) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const { action } = (await req.json()) as { action?: string };
  try {
    if (action === "approve") {
      const updated = await approvePayrollRun(run.id, user.id);
      return NextResponse.json({ run: updated });
    }
    if (action === "pay") {
      const updated = await payPayrollRun(run.id, user.id);
      return NextResponse.json({ run: updated });
    }
    return NextResponse.json({ error: tri(lang, "اقدام نامعتبر", "Invalid action", "Ungültige Aktion") }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا", "Error", "Fehler") }, { status: 400 });
  }
}
