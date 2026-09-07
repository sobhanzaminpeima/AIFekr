export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { approveOwnerStatement, sendOwnerStatement, reopenOwnerStatement } from "@/lib/accounting/ownerStatement";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const statement = await prisma.accountingOwnerStatement.findFirst({
    where: { id: params.id, workspaceUserId: ws.workspaceUserId },
    include: { entries: true, property: { select: { title: true, ownerContactId: true } } },
  });
  if (!statement) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });
  return NextResponse.json({ statement });
}

/** { action: "approve" } posts the ledger entry. { action: "send" } emails the owner (statement must already be approved). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const existing = await prisma.accountingOwnerStatement.findFirst({
    where: { id: params.id, workspaceUserId: ws.workspaceUserId },
    include: { property: { select: { title: true, ownerContactId: true } } },
  });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const { action, emailLang } = (await req.json()) as { action?: string; emailLang?: "fa" | "en" | "de" };

  try {
    if (action === "approve") {
      const statement = await approveOwnerStatement(params.id, user.id);
      return NextResponse.json({ statement });
    }
    if (action === "send") {
      if (!existing.property.ownerContactId) {
        return NextResponse.json({ error: tri(lang, "این ملک مالک ثبت‌شده ندارد", "This property has no owner contact set", "Diese Immobilie hat keinen hinterlegten Eigentümer") }, { status: 400 });
      }
      const owner = await prisma.crmContact.findUnique({ where: { id: existing.property.ownerContactId } });
      if (!owner?.email) {
        return NextResponse.json({ error: tri(lang, "ایمیل مالک ثبت نشده است", "Owner has no email on file", "Für den Eigentümer ist keine E-Mail hinterlegt") }, { status: 400 });
      }
      // The sent email/statement's language is chosen independently of the
      // admin's own UI language (emailLang) -- an admin working in Persian
      // can still send an English copy to a non-Iranian owner. Falls back to
      // the admin's own language if the caller doesn't specify one.
      const statement = await sendOwnerStatement(params.id, owner.email, owner.name, emailLang || lang);
      return NextResponse.json({ statement });
    }
    if (action === "reopen") {
      const statement = await reopenOwnerStatement(params.id, ws.workspaceUserId, user.id);
      return NextResponse.json({ statement });
    }
    return NextResponse.json({ error: tri(lang, "عملیات نامعتبر است", "Invalid action", "Ungültige Aktion") }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در به‌روزرسانی گزارش تسویه", "Failed to update owner statement", "Fehler beim Aktualisieren der Eigentümerabrechnung") }, { status: 400 });
  }
}
