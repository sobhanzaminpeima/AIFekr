export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runCeoAnalysis } from "@/lib/agents/ceoOrchestrator";
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
    select: { id: true, email: true, name: true },
  });

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const u of users) {
    try {
      let analysis = "";
      await runCeoAnalysis(u.id, (text) => { analysis += text; });

      if (u.email) {
        await sendEmail(
          u.email,
          "خلاصهٔ روزانهٔ مدیرعامل هوش مصنوعی — AiFekr",
          `<div dir="rtl" style="font-family:Tahoma;padding:24px;max-width:640px;">
            <h2>سلام ${u.name || ""}!</h2>
            <p>تحلیل خودکار امروز مدیرعامل هوش مصنوعی کسب‌وکار شما آماده است:</p>
            <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin:16px 0;">${markdownToHtml(analysis)}</div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ceo/orchestrator" style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">مشاهدهٔ کامل در AiFekr</a>
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
