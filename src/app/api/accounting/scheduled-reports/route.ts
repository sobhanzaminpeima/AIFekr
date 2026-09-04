export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { createScheduledReport, listScheduledReports, ReportType, Frequency } from "@/lib/accounting/scheduledReports";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

const VALID_TYPES: ReportType[] = ["weekly_summary", "monthly_pl", "monthly_vat"];
const VALID_FREQUENCIES: Frequency[] = ["weekly", "monthly"];

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });

  const reports = await listScheduledReports(ws.workspaceUserId);
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { reportType, frequency, recipientEmail, lang: reportLang } = (await req.json()) as {
    reportType?: string; frequency?: string; recipientEmail?: string; lang?: "fa" | "en" | "de";
  };
  if (!reportType || !VALID_TYPES.includes(reportType as ReportType)) return NextResponse.json({ error: tri(lang, "نوع گزارش نامعتبر است", "Invalid report type", "Ungültiger Berichtstyp") }, { status: 400 });
  if (!frequency || !VALID_FREQUENCIES.includes(frequency as Frequency)) return NextResponse.json({ error: tri(lang, "دوره تناوب نامعتبر است", "Invalid frequency", "Ungültige Häufigkeit") }, { status: 400 });
  if (!recipientEmail) return NextResponse.json({ error: tri(lang, "ایمیل گیرنده الزامی است", "Recipient email is required", "Empfänger-E-Mail ist erforderlich") }, { status: 400 });

  const report = await createScheduledReport({
    workspaceUserId: ws.workspaceUserId,
    reportType: reportType as ReportType,
    frequency: frequency as Frequency,
    recipientEmail,
    lang: reportLang,
  });
  return NextResponse.json({ report });
}
