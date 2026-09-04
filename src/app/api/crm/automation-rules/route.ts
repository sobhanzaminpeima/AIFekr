export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const VALID_TRIGGERS = ["stale_deal", "no_activity_days"] as const;
const VALID_ACTIONS = ["create_task"] as const;
// send_notification / notify_crm_agent are in the original spec but have no
// backing infra yet (no email/SMS channel wired for CRM, no CRM Agent built) —
// only create_task actually does something in this phase. Rejecting the
// others here instead of silently accepting a rule that will never fire.

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const rules = await prisma.crmAutomationRule.findMany({
    where: { userId: ws.workspaceUserId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند قانون اتوماسیون بسازد", "Only a manager or owner can create an automation rule", "Nur ein Manager oder Eigentümer kann eine Automatisierungsregel erstellen") }, { status: 403 });

  const { name, trigger, condition, action } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: tri(lang, "نام قانون الزامی است", "Rule name is required", "Regelname ist erforderlich") }, { status: 400 });
  if (!VALID_TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: tri(lang, "نوع محرک نامعتبر است", "Invalid trigger type", "Ungültiger Auslösertyp") }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: tri(lang, "این نوع اقدام هنوز پشتیبانی نمی‌شود", "This action type is not yet supported", "Dieser Aktionstyp wird noch nicht unterstützt") }, { status: 400 });
  }
  const days = condition?.days;
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ error: tri(lang, "تعداد روز باید یک عدد مثبت باشد", "Number of days must be a positive number", "Die Anzahl der Tage muss eine positive Zahl sein") }, { status: 400 });
  }

  const rule = await prisma.crmAutomationRule.create({
    data: {
      userId: ws.workspaceUserId,
      name: name.trim(),
      trigger,
      condition: JSON.stringify({ days }),
      action,
    },
  });
  return NextResponse.json({ rule });
}
