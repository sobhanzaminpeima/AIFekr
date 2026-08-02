export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { runCrmAnalysis } from "@/lib/agents/crmAgent";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await runCrmAnalysis(user.id, (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("CRM agent error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "خطا در تحلیل. لطفاً دوباره تلاش کنید." })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
