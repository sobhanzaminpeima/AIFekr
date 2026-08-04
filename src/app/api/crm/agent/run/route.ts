export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { runCrmAnalysis } from "@/lib/agents/crmAgent";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: "این قابلیت نیاز به خرید افزونه CRM دارد" }, { status: 402 });
  // Runs a workspace-wide, credit-costed analysis — reserved for MANAGER/OWNER
  // so an AGENT can't spend the workspace's credits on a run whose output
  // (full-team pipeline health) they wouldn't even be allowed to see in full.
  if (ws.isAgentRestricted) return NextResponse.json({ error: "فقط مدیر یا مالک می‌تواند تحلیل CRM را اجرا کند" }, { status: 403 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await runCrmAnalysis(ws.workspaceUserId, (text) => {
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
