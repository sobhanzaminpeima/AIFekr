export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Ledger drill-down for one account — the target of the clickable "(حساب
 * ۵۲۰۰)"-style citations the Finance AI Agent puts in its answers, so a
 * cited number can actually be traced back to its source journal lines.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const account = await prisma.accountingAccount.findFirst({ where: { workspaceUserId: ws.workspaceUserId, code: params.code } });
  if (!account) return NextResponse.json({ error: tri(lang, "حساب پیدا نشد", "Account not found", "Konto nicht gefunden") }, { status: 404 });

  const lines = await prisma.accountingJournalEntryLine.findMany({
    where: { accountId: account.id },
    include: { entry: { select: { id: true, entryDate: true, memo: true, sourceRef: true, postedBy: true, isReversed: true } } },
    orderBy: { entry: { entryDate: "desc" } },
    take: 200,
  });

  return NextResponse.json({ account, lines });
}
