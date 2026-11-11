export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { MAX_RECIPIENTS, maskMobile, resolveAudience, type Audience } from "@/lib/sms/audience";
import { sendTextSms } from "@/lib/sms/send";
import { SmsError } from "@/lib/sms/smsirApi";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Admin SMS to one user, picked users, typed numbers or a customer segment.
 * `preview: true` only counts and shows a few masked numbers. A real send must
 * repeat the previewed count (`confirmCount`), so the list cannot grow between
 * the preview and the click. Numbers are never stored; the send is recorded
 * with its counts and audited.
 */
const audience = z.discriminatedUnion("type", [
  z.object({ type: z.literal("users"), userIds: z.array(z.string().min(1).max(40)).min(1).max(MAX_RECIPIENTS) }),
  z.object({ type: z.literal("phones"), phones: z.array(z.string().max(20)).min(1).max(MAX_RECIPIENTS) }),
  z.object({
    type: z.literal("segment"),
    segment: z.object({
      plans: z.array(z.string().max(40)).max(30).optional(),
      paid: z.enum(["paid", "unpaid"]).optional(),
      signedUpWithinDays: z.number().int().min(1).max(3650).optional(),
      languages: z.array(z.enum(["fa", "en", "de", "tr"])).optional(),
      consentedOnly: z.boolean().optional(),
    }).strict(),
  }),
]);
const schema = z.object({
  audience,
  text: z.string().trim().min(2).max(600),
  preview: z.boolean().optional(),
  confirmCount: z.number().int().min(1).optional(),
}).strict();

const describe = (a: Audience) => a.type === "users" ? { type: "users", count: a.userIds.length } : a.type === "phones" ? { type: "phones", count: a.phones.length } : { type: "segment", segment: a.segment };

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const { audience: a, text, preview, confirmCount } = parsed.data;

  const { mobiles, skipped } = await resolveAudience(a as Audience);
  if (mobiles.length > MAX_RECIPIENTS) return NextResponse.json({ error: `More than ${MAX_RECIPIENTS} recipients; narrow the audience`, code: "TOO_MANY_RECIPIENTS" }, { status: 400 });
  if (preview) return NextResponse.json({ recipients: mobiles.length, skipped, sample: mobiles.slice(0, 5).map(maskMobile), segments: Math.ceil(text.length / 70) });

  if (!mobiles.length) return NextResponse.json({ error: "No recipient has a valid mobile number", code: "NO_RECIPIENTS" }, { status: 400 });
  if (confirmCount !== mobiles.length) return NextResponse.json({ error: "The audience changed since the preview; preview again", code: "COUNT_CHANGED", recipients: mobiles.length }, { status: 409 });
  if (!rateLimit(`admin-sms-send:${admin.id}`, 10, 60 * 60_000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });

  const record = await prisma.smsBroadcast.create({ data: { actorId: admin.id, text, audience: JSON.stringify(describe(a as Audience)), recipients: mobiles.length } });
  try {
    const r = await sendTextSms(mobiles, text);
    const status = r.sent > 0 ? "done" : "failed";
    await prisma.smsBroadcast.update({ where: { id: record.id }, data: { sent: r.sent, failed: r.failed, cost: r.cost, status, error: r.errors.join(" | ") || null, finishedAt: new Date() } });
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "sms_broadcast_sent", metadata: JSON.stringify({ broadcastId: record.id, recipients: mobiles.length, sent: r.sent, failed: r.failed }) } });
    return NextResponse.json({ id: record.id, recipients: mobiles.length, ...r }, { status: status === "done" ? 200 : 502 });
  } catch (e) {
    const error = e instanceof SmsError ? `${e.code}: ${e.message}` : "send failed";
    await prisma.smsBroadcast.update({ where: { id: record.id }, data: { status: "failed", error, failed: mobiles.length, finishedAt: new Date() } });
    return NextResponse.json({ error, code: "SMS_FAILED" }, { status: 502 });
  }
}
