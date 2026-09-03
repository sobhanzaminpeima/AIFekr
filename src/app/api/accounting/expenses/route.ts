export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { createExpense } from "@/lib/accounting/expenses";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const expenses = await prisma.accountingExpense.findMany({
    where: { workspaceUserId: ws.workspaceUserId, ...(status ? { status } : {}) },
    include: { vendor: true },
    orderBy: { expenseDate: "desc" },
  });
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const body = await req.json();
  const { vendorId, kind, accountCode, amount, description, receiptUrl, expenseDate, dueDate } = body as {
    vendorId?: string; kind?: "bill" | "cash_expense"; accountCode?: string; amount?: number; description?: string; receiptUrl?: string; expenseDate?: string; dueDate?: string;
  };
  if (!accountCode || typeof amount !== "number" || amount <= 0 || !description?.trim()) {
    return NextResponse.json({ error: tri(lang, "کد حساب، مبلغ و توضیحات الزامی است", "Account code, amount, and description are required", "Kontocode, Betrag und Beschreibung sind erforderlich") }, { status: 400 });
  }

  try {
    await ensureDefaultChartOfAccounts(ws.workspaceUserId);
    const expense = await createExpense({
      workspaceUserId: ws.workspaceUserId,
      vendorId,
      kind,
      accountCode,
      amount,
      description: description.trim(),
      receiptUrl,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ثبت هزینه", "Failed to record expense", "Fehler beim Erfassen der Ausgabe") }, { status: 400 });
  }
}
