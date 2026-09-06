export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { runCeoAnalysis } from "@/lib/agents/ceoOrchestrator";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  // The orchestrator used to take no language at all -- every user got the
  // Persian briefing. It follows the reader's UI language now.
  const lang = await getServerLang();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await runCeoAnalysis(user.id, lang, (text: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("CEO orchestrator error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: tri(lang, "خطا در تحلیل. لطفاً دوباره تلاش کنید.", "Analysis failed. Please try again.", "Analyse fehlgeschlagen. Bitte erneut versuchen.") })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
