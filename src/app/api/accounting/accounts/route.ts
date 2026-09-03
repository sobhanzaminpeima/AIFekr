export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Chart of accounts for the caller's workspace — seeds the default template on first access. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) {
    return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  }

  await ensureDefaultChartOfAccounts(ws.workspaceUserId);

  const accounts = await prisma.accountingAccount.findMany({
    where: { workspaceUserId: ws.workspaceUserId },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({ accounts });
}

/** Adds a custom account alongside the seeded default chart. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) {
    return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  }
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const body = await req.json();
  const { code, name, nameEn, nameDe, type, parentId } = body as {
    code?: string; name?: string; nameEn?: string; nameDe?: string; type?: string; parentId?: string;
  };
  const VALID_TYPES = ["asset", "liability", "equity", "revenue", "expense"];
  if (!code?.trim() || !name?.trim() || !type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: tri(lang, "کد، نام و نوع حساب الزامی است", "Account code, name, and a valid type are required", "Kontocode, Name und ein gültiger Typ sind erforderlich") }, { status: 400 });
  }

  try {
    const account = await prisma.accountingAccount.create({
      data: { workspaceUserId: ws.workspaceUserId, code: code.trim(), name: name.trim(), nameEn, nameDe, type, parentId },
    });
    return NextResponse.json({ account });
  } catch (err) {
    return NextResponse.json({ error: tri(lang, "این کد حساب قبلاً استفاده شده است", "This account code is already in use", "Dieser Kontocode wird bereits verwendet") }, { status: 409 });
  }
}
