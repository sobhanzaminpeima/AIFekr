export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  chatIdentity,
  issueGuest,
  guestToken,
  guestCookie,
  verifyGuestToken,
} from "@/lib/ai-chat/identity";
import { chatPolicy } from "@/lib/ai-chat/policy";
import { expireChatRequests, mergeGuest } from "@/lib/ai-chat/service";
import { prisma } from "@/lib/db/prisma";
import { getAvailableCredits } from "@/lib/utils/teamCredits";
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  try {
    const policy = await chatPolicy();
    if (!policy.enabled)
      return NextResponse.json({ error: "CHAT_DISABLED" }, { status: 503 });
    await expireChatRequests();
    let identity = await chatIdentity(req);
    let freshCookie: string | undefined;
    if (!identity) {
      const g = await issueGuest(req, policy);
      freshCookie = guestToken(g.id);
      identity = { key: `g:${g.id}`, guest: g, user: null };
    }
    let mergedConversationId: string | null = null;
    if (identity.user) {
      const guestId = verifyGuestToken(req.cookies.get(guestCookie)?.value);
      if (guestId)
        mergedConversationId = await mergeGuest(identity.user.id, guestId);
    }
    const used =
      identity.guest?.used ??
      (await prisma.aiChatRequest.count({
        where: {
          userId: identity.user!.id,
          status: "SUCCEEDED",
          createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        },
      }));
    const response = NextResponse.json(
      {
        authenticated: !!identity.user,
        name: identity.user?.name,
        chatOnly: identity.user?.chatOnly,
        chatPlanExpiry: identity.user?.chatPlanExpiry,
        remaining: Math.max(
          0,
          (identity.guest ? policy.guestTurns : policy.registeredFreeDaily) -
            used,
        ),
        creditsPerTurn: policy.creditsPerTurn,
        credits: identity.user
          ? await getAvailableCredits(identity.user.id, prisma, "CHAT")
          : 0,
        messages: identity.guest ? JSON.parse(identity.guest.transcript) : [],
        mergedConversationId,
        retentionHours: policy.guestTtlHours,
        discoveryEnabled: policy.discoveryEnabled,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (freshCookie)
      response.cookies.set(guestCookie, freshCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: policy.guestTtlHours * 3600,
      });
    return response;
  } catch {
    return NextResponse.json({ error: "SESSION_UNAVAILABLE" }, { status: 400 });
  }
}
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  const id = verifyGuestToken(req.cookies.get(guestCookie)?.value);
  if (id) {
    if (
      await prisma.aiChatRequest.count({
        where: { guestId: id, status: "PENDING" },
      })
    )
      return NextResponse.json(
        { error: "REQUEST_IN_PROGRESS" },
        { status: 409 },
      );
    await prisma.aiChatRequest.updateMany({
      where: { guestId: id },
      data: { input: "", output: "" },
    });
    await prisma.aiChatGuest.deleteMany({ where: { id } });
  }
  const r = NextResponse.json({ ok: true });
  r.cookies.delete(guestCookie);
  return r;
}
