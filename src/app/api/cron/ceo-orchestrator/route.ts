export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runCeoAnalysis } from "@/lib/agents/ceoOrchestrator";
import { stripMemorySection } from "@/lib/agents/ceoMemoryFormat";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";
import { sendEmail } from "@/lib/email/resend";
import { markdownToHtml } from "@/lib/utils/markdownToHtml";

// Hit by a system crontab entry once a day — runs the CEO orchestrator
// automatically for every user who opted in (ceoAutoRunEnabled), same
// "no human click needed" pattern as /api/cron/instagram-publish.
// Protected by a shared secret since it has no user session.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { ceoAutoRunEnabled: true, isBlocked: false },
    select: { id: true, email: true, name: true, ceoAutoRunLang: true },
  });

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const u of users) {
    try {
      // Captured when the user switched auto-run on; defaults to "fa", which is
      // exactly what every existing row was already getting.
      const lang: Lang = (["fa", "en", "de"] as const).includes(u.ceoAutoRunLang as Lang)
        ? (u.ceoAutoRunLang as Lang)
        : "fa";
      let analysis = "";
      await runCeoAnalysis(u.id, lang, (text: string) => { analysis += text; });
      // The memory marker and its category lines are instructions to the next
      // run, not something a human should read in their morning email.
      const emailBody = stripMemorySection(analysis);

      if (u.email) {
        await sendEmail(
          u.email,
          tri(lang, "خلاصهٔ روزانهٔ مدیرعامل هوش مصنوعی — AiFekr", "Your daily AI CEO briefing — AiFekr", "Ihr täglicher KI-CEO-Bericht — AiFekr"),
          `<div dir="${lang === "fa" ? "rtl" : "ltr"}" style="font-family:Tahoma;padding:24px;max-width:640px;">
            <h2>${tri(lang, `سلام ${u.name || ""}!`, `Hi ${u.name || ""}!`, `Hallo ${u.name || ""}!`)}</h2>
            <p>${tri(lang, "تحلیل خودکار امروز مدیرعامل هوش مصنوعی کسب‌وکار شما آماده است:", "Today's automatic analysis from your AI CEO is ready:", "Die heutige automatische Analyse Ihres KI-CEO ist fertig:")}</p>
            <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin:16px 0;">${markdownToHtml(emailBody)}</div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ceo/orchestrator" style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">${tri(lang, "مشاهدهٔ کامل در AiFekr", "View the full report in AiFekr", "Vollständigen Bericht in AiFekr ansehen")}</a>
          </div>`
        );
      }
      results.push({ userId: u.id, ok: true });
    } catch (err) {
      results.push({ userId: u.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ranFor: users.length, results });
}
