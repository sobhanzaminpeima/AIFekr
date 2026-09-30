export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { instagramWorkspaceScope } from "@/lib/instagram/workspaceScope";
import { getInstagramWebhookSubscription, subscribeToInstagramWebhooks } from "@/lib/instagram";
import { canAutoPublish } from "@/lib/utils/planGates";

async function getConnection(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return { response: unauthorizedResponse() };
  if (!canAutoPublish(user.plan)) {
    return { response: NextResponse.json({ error: "این قابلیت فقط برای پلن‌های Pro و Team فعال است" }, { status: 403 }) };
  }
  const businessId = await activeBusinessIdFor(user.id);
  const connection = await prisma.instagramConnection.findFirst({
    where: { userId: user.id, ...instagramWorkspaceScope(businessId) },
    select: { igUserId: true, accessToken: true },
  });
  if (!connection) return { response: NextResponse.json({ error: "اینستاگرام این کسب‌وکار متصل نیست" }, { status: 400 }) };
  return { user, connection };
}

export async function GET(req: NextRequest) {
  const result = await getConnection(req);
  if ("response" in result) return result.response;
  try {
    const status = await getInstagramWebhookSubscription(result.connection.igUserId, result.connection.accessToken);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "بررسی وضعیت webhook ناموفق بود";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const result = await getConnection(req);
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
