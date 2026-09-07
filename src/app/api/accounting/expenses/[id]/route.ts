export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { approveExpense, rejectExpense, payExpense, FX_RATE_UNAVAILABLE } from "@/lib/accounting/expenses";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const VALID_ACTIONS = ["approve", "reject", "pay"];

/** action-based PUT — { action: "approve" | "reject" | "pay" } — matches the invoice route's status-transition style. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const existing = await prisma.accountingExpense.findFirst({ where: { id: params.id, workspaceUserId: ws.workspaceUserId } });
  if (!existing) return NextResponse.json({ error: tri(lang, "پیدا نشد", "Not found", "Nicht gefunden") }, { status: 404 });

  const { action } = (await req.json()) as { action?: string };
  if (!action || !VALID_ACTIONS.includes(action)) return NextResponse.json({ error: tri(lang, "عملیات نامعتبر است", "Invalid action", "Ungültige Aktion") }, { status: 400 });

  try {
    let expense;
    if (action === "approve") expense = await approveExpense(params.id, user.id);
    else if (action === "reject") expense = await rejectExpense(params.id, user.id);
    else expense = await payExpense(params.id, user.id);
    return NextResponse.json({ expense });
  } catch (err) {
    if (err instanceof Error && err.message === FX_RATE_UNAVAILABLE) {
      return NextResponse.json({ error: tri(lang,
        "نرخ ارز برای تبدیل این هزینه به تومان در حال حاضر در دسترس نیست — بدون حدس زدن، ثبت انجام نشد. کمی بعد دوباره امتحان کنید.",
        "No exchange rate is available to convert this expense to Toman right now — it was not posted rather than guessed. Try again shortly.",
        "Derzeit ist kein Wechselkurs verfügbar, um diese Ausgabe in Toman umzurechnen — sie wurde nicht gebucht, statt zu raten. Versuchen Sie es in Kürze erneut.")
      }, { status: 503 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : tri(lang, "خطا در به‌روزرسانی هزینه", "Failed to update expense", "Fehler beim Aktualisieren der Ausgabe") }, { status: 400 });
  }
}
