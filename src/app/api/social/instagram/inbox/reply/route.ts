export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { sendTextMessage } from "@/lib/instagram";
import { canAutoPublish } from "@/lib/utils/planGates";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (!canAutoPublish(user.plan)) {
    return NextResponse.json({ error: "این صندوق پیام در پلن‌های Pro و Team فعال است" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }
  const recipientId = typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const clientRequestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!recipientId || !text || text.length > 1000 || !/^[A-Za-z0-9._-]{12,80}$/.test(clientRequestId)) {
    return NextResponse.json({ error: "متن پاسخ، مخاطب و شناسهٔ درخواست معتبر لازم است" }, { status: 400 });
  }

  const businessId = await activeBusinessIdFor(user.id);
  const scope = { userId: user.id, ...instagramWorkspaceScope(businessId) };
  const connection = await prisma.instagramConnection.findFirst({ where: scope });
  if (!connection) return NextResponse.json({ error: "اینستاگرام این کسب‌وکار متصل نیست" }, { status: 400 });

  // An agent may only reply to a sender who initiated a conversation with this
  // exact connected workspace. Meta remains the final authority on its reply window.
  const initiatedConversation = await prisma.instagramDirectMessageLog.findFirst({
    where: { ...scope, senderId: recipientId, direction: "inbound" },
    select: { id: true },
  });
  if (!initiatedConversation) return NextResponse.json({ error: "این مخاطب قبلاً به همین حساب اینستاگرام پیام نداده است" }, { status: 403 });

  const eventId = `manual:${user.id}:${businessId || "personal"}:${clientRequestId}`;
  const existing = await prisma.instagramDirectMessageLog.findUnique({ where: { eventId } });
  if (existing) {
    if (existing.status === "sent") return NextResponse.json({ success: true, duplicate: true, message: existing });
    return NextResponse.json({ error: "این پاسخ قبلاً ثبت شده؛ وضعیت آن را در صندوق پیام بررسی کنید", message: existing }, { status: 409 });
  }

  const message = await prisma.instagramDirectMessageLog.create({
    data: { ...scope, eventId, senderId: recipientId, direction: "outbound", text, status: "sending" },
  }).catch(async (error) => {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "P2002") {
      return prisma.instagramDirectMessageLog.findUnique({ where: { eventId } });
    }
    throw error;
  });
  if (!message) return NextResponse.json({ error: "ثبت پاسخ ناموفق بود" }, { status: 500 });
  if (message.status !== "sending") {
    return message.status === "sent"
      ? NextResponse.json({ success: true, duplicate: true, message })
      : NextResponse.json({ error: "این پاسخ قبلاً ثبت شده و ارسال خودکار دوباره انجام نشد", message }, { status: 409 });
  }

  try {
    await sendTextMessage(connection.igUserId, recipientId, connection.accessToken, text);
    const sent = await prisma.instagramDirectMessageLog.update({ where: { id: message.id }, data: { status: "sent" } });
    return NextResponse.json({ success: true, message: sent });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Instagram send failed";
    const failed = await prisma.instagramDirectMessageLog.update({ where: { id: message.id }, data: { status: "failed", error: detail.slice(0, 500) } });
    return NextResponse.json({ error: detail, message: failed }, { status: 502 });
  }
}
