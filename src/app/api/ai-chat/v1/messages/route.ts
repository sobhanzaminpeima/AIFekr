export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatIdentity } from "@/lib/ai-chat/identity";
import { claimTurn, settleTurn, failTurn } from "@/lib/ai-chat/service";
import { independentChatProvider } from "@/lib/ai-chat/provider";
import { rateLimit, getClientIp } from "@/lib/utils/rateLimit";
const inputSchema = z
  .object({
    id: z.uuid(),
    message: z.string().trim().min(1).max(2000),
    conversationId: z.string().max(100).optional(),
    language: z.enum(["fa", "en", "de", "tr"]),
  })
  .strict();
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  let claim: Awaited<ReturnType<typeof claimTurn>>;
  let body: z.infer<typeof inputSchema>;
  try {
    const identity = await chatIdentity(req);
    if (!identity)
      return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
    if (
      !rateLimit(`independent-chat:${identity.key}`, 8, 60000).allowed ||
      !rateLimit(`independent-chat:ip:${getClientIp(req.headers)}`, 30, 60000)
        .allowed
    )
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    const text = await req.text();
    if (text.length > 12000) throw Error("INPUT_TOO_LARGE");
    body = inputSchema.parse(JSON.parse(text));
    claim = await claimTurn(identity, body);
    if (claim.status === "FAILED") throw Error("PREVIOUS_REQUEST_FAILED");
    if (claim.status === "PENDING" && !("history" in claim))
      return NextResponse.json(
        { error: "REQUEST_IN_PROGRESS" },
        { status: 409 },
      );
  } catch (e) {
    const error = e instanceof Error ? e.message : "INVALID_REQUEST";
    return NextResponse.json(
      { error },
      {
        status:
          error === "SIGNUP_REQUIRED"
            ? 401
            : error === "INSUFFICIENT_CREDITS"
              ? 402
              : 400,
      },
    );
  }
  const abort = new AbortController(),
    timeout = setTimeout(() => abort.abort(), 45000);
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (!closed)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
      };
      try {
        send({
          requestId: claim.id,
          conversationId: claim.conversationId,
          credits: claim.credits,
        });
        if (claim.status === "SUCCEEDED") {
          send({ text: claim.output });
          send({ done: true });
          return;
        }
        let output = "";
        const usage = await independentChatProvider(
          claim.model,
          "history" in claim ? claim.history : [],
          body.message,
          body.language,
          (text) => {
            if (abort.signal.aborted) throw Error("CANCELLED");
            output += text;
            if (output.length > 20000) throw Error("OUTPUT_TOO_LARGE");
            send({ text });
          },
          abort.signal,
        );
        if (abort.signal.aborted) throw Error("CANCELLED");
        await settleTurn(claim.id, output, usage);
        send({ done: true });
      } catch {
        await failTurn(
          claim.id,
          abort.signal.aborted ? "CANCELLED" : "PROVIDER_UNAVAILABLE",
        );
        send({
          error: abort.signal.aborted ? "CANCELLED" : "PROVIDER_UNAVAILABLE",
          refunded: true,
        });
      } finally {
        clearTimeout(timeout);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      abort.abort();
      void failTurn(claim.id, "CANCELLED");
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
