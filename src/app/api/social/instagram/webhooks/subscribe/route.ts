export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { getInstagramProfile, getInstagramWebhookSubscription, subscribeToInstagramWebhooks } from "@/lib/instagram";
import { canAutoPublish } from "@/lib/utils/planGates";

/**
 * Checking health is open to whoever owns the connection, whatever their plan.
 * Turning event delivery on is a plan feature, which an administrator's role also allows.
 */
async function getConnection(req: NextRequest, purpose: "diagnose" | "enable") {
  const user = await requireAuth(req);
  if (!user) return { response: unauthorizedResponse(req) };
  const admin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (purpose === "enable" && !admin && !canAutoPublish(user.plan)) {
    return { response: NextResponse.json({ error: "این قابلیت فقط برای پلن‌های Pro و Team فعال است" }, { status: 403 }) };
  }
  const businessId = await activeBusinessIdFor(user.id);
  const workspace = instagramWorkspaceScope(businessId);
  const connection = await prisma.instagramConnection.findFirst({
    where: { userId: user.id, ...workspace },
    select: { igUserId: true, igUsername: true, accessToken: true, tokenExpiry: true, createdAt: true },
  });
  if (!connection) return { response: NextResponse.json({ error: "اینستاگرام این کسب‌وکار متصل نیست" }, { status: 400 }) };
  return { user, connection, workspace };
}

/** A real round trip to Meta. A failing step is reported in the result, never hidden behind an error page. */
export async function GET(req: NextRequest) {
  const result = await getConnection(req, "diagnose");
  if ("response" in result) return result.response;
  const { connection, user, workspace } = result;
  const [profile, subscription, lastDirect, lastComment] = await Promise.all([
    getInstagramProfile(connection.accessToken).then(() => true, () => false),
    getInstagramWebhookSubscription(connection.igUserId, connection.accessToken).catch(() => null),
    prisma.instagramDirectMessageLog.findFirst({ where: { userId: user.id, ...workspace, direction: "inbound" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.instagramCommentReplyLog.findFirst({ where: { userId: user.id, ...workspace }, orderBy: { createdAt: "desc" }, select: { createdAt: true, status: true } }),
  ]);
  const events = [lastDirect?.createdAt, lastComment?.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime());
  return NextResponse.json({
    igUsername: connection.igUsername,
    connectedAt: connection.createdAt,
    tokenExpiry: connection.tokenExpiry,
    tokenValid: profile,
    subscribed: subscription?.subscribed ?? false,
    subscriptionChecked: subscription !== null,
    fields: subscription?.fields ?? [],
    lastEventAt: events[0] ?? null,
    lastDeliveryResult: lastComment?.status ?? null,
    checkedAt: new Date(),
  });
}

export async function POST(req: NextRequest) {
  const result = await getConnection(req, "enable");
  if ("response" in result) return result.response;

  try {
    await subscribeToInstagramWebhooks(result.connection.igUserId, result.connection.accessToken);
    const status = await getInstagramWebhookSubscription(result.connection.igUserId, result.connection.accessToken);
    if (!status.subscribed) {
      return NextResponse.json({
        error: "Meta درخواست را پذیرفت، اما اشتراک حساب کامل تأیید نشد. فیلدهای Instagram Webhooks اپ Meta و دسترسی‌های comments/messages را بررسی کنید.",
        fields: status.fields,
      }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فعالسازی webhook اینستاگرام ناموفق بود";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
