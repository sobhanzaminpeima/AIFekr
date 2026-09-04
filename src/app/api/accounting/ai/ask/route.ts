export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { askFinanceAgent } from "@/lib/agents/financeAgent";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Streaming Q&A over the ledger (spec ۸ item ۱) — same SSE shape as crm/agent/run. Read-only: never writes anything. */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (ws.isAgentRestricted) return NextResponse.json({ error: tri(lang, "دسترسی ندارید", "Not authorized", "Nicht autorisiert") }, { status: 403 });

  const { question } = (await req.json()) as { question?: string };
  if (!question || !question.trim()) {
    return NextResponse.json({ error: tri(lang, "سؤال الزامی است", "A question is required", "Eine Frage ist erforderlich") }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await askFinanceAgent(ws.workspaceUserId, question, (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("Finance AI agent error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: tri(lang, "خطا در پاسخ‌دهی. لطفاً دوباره تلاش کنید.", "Failed to answer. Please try again.", "Antwort fehlgeschlagen. Bitte versuchen Sie es erneut.") })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
