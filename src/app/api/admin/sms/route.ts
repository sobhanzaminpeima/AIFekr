export const dynamic = "force-dynamic";
import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getSmsConfig, publicSmsConfig, saveSmsConfig } from "@/lib/sms/config";
import { SmsError, smsirCredit, smsirLines, smsirTemplates } from "@/lib/sms/smsirApi";
import { onesmsBalance } from "@/lib/sms/onesmsApi";
import { sendOtpSms } from "@/lib/sms/send";
import { normalizeMobile } from "@/lib/sms/audience";
import { PHONE_SIGNUP_KEY, phoneSignupEnabled } from "@/lib/auth/phoneSignup";
import { rateLimit } from "@/lib/utils/rateLimit";

/**
 * Admin SMS settings: the provider key (write-only), line and OTP template;
 * a live key check; the mobile sign-up switch; a test code to the admin's
 * own phone; and recent sends. Every change is audited; the key is never
 * returned or logged.
 */
const fail = (e: unknown) => {
  if (e instanceof SmsError) return NextResponse.json({ error: e.message, code: `SMS_${e.code}` }, { status: 502 });
  if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid settings", code: "INVALID_SETTINGS" }, { status: 400 });
  return NextResponse.json({ error: "SMS request failed", code: "SMS_FAILED" }, { status: 502 });
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  const [config, phoneSignup, broadcasts] = await Promise.all([
    getSmsConfig(),
    phoneSignupEnabled(),
    prisma.smsBroadcast.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, text: true, audience: true, recipients: true, sent: true, failed: true, cost: true, status: true, error: true, createdAt: true } }),
  ]);
  return NextResponse.json({ config: publicSmsConfig(config), phoneSignup, broadcasts });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  try {
    const config = await saveSmsConfig(await req.json());
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "sms_settings_saved", metadata: JSON.stringify({ configured: config.configured, lineNumber: config.lineNumber, otpTemplateId: config.otpTemplateId }) } });
    return NextResponse.json({ config });
  } catch (e) {
    return fail(e);
  }
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check") }),
  z.object({ action: z.literal("templates") }),
  z.object({ action: z.literal("phoneSignup"), enabled: z.boolean() }),
  z.object({ action: z.literal("testCode"), phone: z.string().max(20) }),
]);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse(req);
  if (!rateLimit(`admin-sms:${admin.id}`, 20, 60_000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
  const body = action.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const c = await getSmsConfig();
  try {
    switch (body.data.action) {
      case "check": {
        // Free, read-only calls: proves the key, shows credit and the lines it may send from.
        if (c.provider === "onesms") return NextResponse.json({ ok: true, credit: await onesmsBalance(c.apiKey), lines: c.lineNumber ? [c.lineNumber] : [], lineConfigured: !!c.lineNumber, linesUnverified: true });
        const [credit, lines] = await Promise.all([smsirCredit(c.apiKey), smsirLines(c.apiKey)]);
        return NextResponse.json({ ok: true, credit, lines: lines.map(String), lineConfigured: !!c.lineNumber && lines.map(String).includes(c.lineNumber) });
      }
      case "templates":
        if (c.provider === "onesms") return NextResponse.json({ error: "onesms has no template list API; copy the pattern key from the onesms panel", code: "NOT_SUPPORTED" }, { status: 400 });
        return NextResponse.json({ templates: await smsirTemplates(c.apiKey) });
      case "phoneSignup": {
        await prisma.siteSetting.upsert({ where: { key: PHONE_SIGNUP_KEY }, create: { key: PHONE_SIGNUP_KEY, value: JSON.stringify({ enabled: body.data.enabled }) }, update: { value: JSON.stringify({ enabled: body.data.enabled }) } });
        await prisma.auditLog.create({ data: { actorId: admin.id, action: "phone_signup_toggled", metadata: JSON.stringify({ enabled: body.data.enabled }) } });
        return NextResponse.json({ phoneSignup: body.data.enabled });
      }
      case "testCode": {
        const phone = normalizeMobile(body.data.phone);
        if (!phone) return NextResponse.json({ error: "Invalid mobile number", code: "INVALID_PHONE" }, { status: 400 });
        // A real code through the real template, so the whole sign-in path is proven; the code is not shown here.
        const ok = await sendOtpSms(phone, String(randomInt(1000, 10000)));
        await prisma.auditLog.create({ data: { actorId: admin.id, action: "sms_test_code", metadata: JSON.stringify({ ok }) } });
        return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "The provider did not accept the message", code: "SMS_NOT_SENT" }, { status: 502 });
      }
    }
  } catch (e) {
    return fail(e);
  }
}
