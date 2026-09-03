export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { generateOwnerStatement } from "@/lib/accounting/ownerStatement";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting/chartOfAccounts";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const propertyId = req.nextUrl.searchParams.get("propertyId") || undefined;
  const statements = await prisma.accountingOwnerStatement.findMany({
    where: { workspaceUserId: ws.workspaceUserId, ...(propertyId ? { propertyId } : {}) },
    include: { property: { select: { title: true } } },
    orderBy: { month: "desc" },
  });
  return NextResponse.json({ statements });
}

/** Generates (or, while still draft, regenerates) a property's monthly owner statement from a list of line items. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const body = await req.json();
  const { propertyId, month, entries, currency } = body as {
    propertyId?: string; month?: string; entries?: { date: string; description: string; category: string; income?: number; expense?: number }[]; currency?: string;
  };
  if (!propertyId || !month || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: tri(lang, "ملک، ماه و حداقل یک ردیف الزامی است", "Property, month, and at least one line item are required", "Immobilie, Monat und mindestens eine Position sind erforderlich") }, { status: 400 });
  }

  const property = await prisma.property.findFirst({ where: { id: propertyId, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک پیدا نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  try {
    await ensureDefaultChartOfAccounts(ws.workspaceUserId);
    const statement = await generateOwnerStatement(
      ws.workspaceUserId,
      propertyId,
      new Date(month),
      entries.map((e) => ({ date: new Date(e.date), description: e.description, category: e.category as "guest_stay" | "maintenance" | "utilities" | "consumables" | "other", income: e.income, expense: e.expense })),
      currency
    );
    return NextResponse.json({ statement });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در ساخت گزارش تسویه", "Failed to generate owner statement", "Fehler beim Erstellen der Eigentümerabrechnung") }, { status: 400 });
  }
}
