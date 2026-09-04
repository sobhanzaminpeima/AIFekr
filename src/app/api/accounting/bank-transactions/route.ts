export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const bankAccountId = req.nextUrl.searchParams.get("bankAccountId") || undefined;
  const transactions = await prisma.accountingBankTransaction.findMany({
    where: { workspaceUserId: ws.workspaceUserId, ...(status ? { status } : {}), ...(bankAccountId ? { bankAccountId } : {}) },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json({ transactions });
}
