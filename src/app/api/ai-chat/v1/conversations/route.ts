export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { chatIdentity } from "@/lib/ai-chat/identity";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
export async function GET(req: NextRequest) {
  const i = await chatIdentity(req);
  if (!i?.user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const c = await prisma.conversation.findFirst({
      where: {
        id,
        userId: i.user.id,
        tool: { in: ["general-chat", "general-chat-archived"] },
      },
      include: {
        messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 500 },
      },
    });
    return c
      ? NextResponse.json(
          { conversation: c },
          { headers: { "Cache-Control": "no-store" } },
        )
      : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(
    {
      conversations: await prisma.conversation.findMany({
        where: {
          userId: i.user.id,
          tool: "general-chat",
          title: {
            contains: (req.nextUrl.searchParams.get("search") || "").slice(
              0,
              100,
            ),
          },
        },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const i = await chatIdentity(req);
  if (!i?.user)
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const b = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("rename"),
          id: z.string().max(100),
          title: z.string().trim().min(1).max(100),
        }),
        z.object({
          action: z.enum(["archive", "delete"]),
          id: z.string().max(100),
        }),
        z.object({
          action: z.literal("truncate"),
          id: z.string().max(100),
          messageId: z.string().max(100),
        }),
        z.object({
          action: z.literal("feedback"),
          id: z.string().max(100),
          value: z.union([z.literal(-1), z.literal(1)]),
        }),
      ])
      .parse(await req.json());
    await prisma.$transaction(async (tx) => {
      if (b.action === "feedback") {
        const r = await tx.aiChatRequest.updateMany({
          where: { id: b.id, userId: i.user!.id, status: "SUCCEEDED" },
          data: { feedback: b.value },
        });
        if (!r.count) throw Error("NOT_FOUND");
        return;
      }
      const c = await tx.conversation.findFirst({
        where: {
          id: b.id,
          userId: i.user!.id,
          tool: { in: ["general-chat", "general-chat-archived"] },
        },
      });
      if (!c) throw Error("NOT_FOUND");
      if (
        await tx.aiChatRequest.count({
          where: { conversationId: c.id, status: "PENDING" },
        })
      )
        throw Error("REQUEST_IN_PROGRESS");
      if (b.action === "rename")
        await tx.conversation.update({
          where: { id: c.id },
          data: { title: b.title },
        });
      if (b.action === "archive")
        await tx.conversation.update({
          where: { id: c.id },
          data: { tool: "general-chat-archived" },
        });
      if (b.action === "delete") {
        await tx.aiChatRequest.updateMany({
          where: { conversationId: c.id },
          data: { input: "", output: "", conversationId: null },
        });
        await tx.conversation.delete({ where: { id: c.id } });
      }
      if (b.action === "truncate") {
        const m = await tx.message.findFirst({
          where: { id: b.messageId, conversationId: c.id, role: "user" },
        });
        if (!m) throw Error("NOT_FOUND");
        await tx.message.deleteMany({
          where: { conversationId: c.id, createdAt: { gte: m.createdAt } },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ACTION_FAILED" }, { status: 400 });
  }
}
