export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

/**
 * Real system status for /admin/system, which used to render invented numbers
 * (see that page's comment). Only reports what this process can actually
 * observe. Integration status is presence of configuration only — never the
 * values, and never a claim that the external service is healthy.
 */

// Names are the ones the code actually reads (several used to be wrong: SMS
// is sent through SMS.ir, and Vapi/Zarinpal can be configured from admin
// settings rather than env). `env` groups are alternatives: the integration
// counts as configured when every name in ANY group is set, or when one of
// `settings` exists in SiteSetting. `test` says how to verify it end to end.
type Integration = { key: string; name: string; required: boolean; env: string[][]; settings?: string[]; test: string };
const INTEGRATIONS: Integration[] = [
  { key: "core", name: "Session & cron secrets", required: true, env: [["JWT_SECRET", "CRON_SECRET"]], test: "Sign in works; cron routes answer 200 with the x-cron-secret header." },
  { key: "llm", name: "AI chat (at least one provider)", required: true, env: [["ANTHROPIC_API_KEY"], ["OPENAI_API_KEY"], ["GEMINI_API_KEY"], ["GOOGLE_API_KEY"], ["DEEPSEEK_API_KEY"], ["OPENROUTER_API_KEY"], ["GROQ_API_KEY"], ["GITHUB_TOKEN_GPT"]], test: "Admin → LLM → Test sends one short prompt to each configured provider." },
  { key: "image", name: "Image generation", required: false, env: [["OPENAI_API_KEY"], ["DASHSCOPE_API_KEY"], ["FAL_KEY"]], test: "Generate one image at /image/generate; without a key production now returns an error instead of a stock photo." },
  { key: "video", name: "Video & music generation", required: false, env: [["DASHSCOPE_API_KEY"], ["REPLICATE_API_TOKEN"]], test: "Start a 5s video; unfinished jobs are refunded by /api/cron/media-job-refunds." },
  { key: "voice_tts", name: "Voices & music (ElevenLabs)", required: false, env: [["ELEVENLABS_API_KEY"]], test: "Generate 30s of music at /music/generate." },
  { key: "storage", name: "File storage (R2)", required: true, env: [["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]], test: "Upload a file in CRM documents and open it again." },
  { key: "email", name: "Email (Resend)", required: true, env: [["RESEND_API_KEY"]], test: "Request a password/owner-portal email to your own address." },
  { key: "sms", name: "SMS login codes (SMS.ir)", required: true, env: [["SMSIR_API_KEY", "SMSIR_LINE_NUMBER"]], test: "Sign in by phone with your own number." },
  { key: "zarinpal", name: "Payments (ZarinPal)", required: true, env: [["ZARINPAL_MERCHANT_ID"]], settings: ["zarinpal_merchant"], test: "Turn on sandbox in Admin → Settings, buy the cheapest package with ZarinPal's sandbox card, confirm credits once, then turn sandbox off." },
  { key: "nowpayments", name: "Crypto payments (NowPayments)", required: false, env: [["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET"]], test: "Use the NowPayments sandbox account; the IPN must reach /api/webhooks/nowpayments." },
  { key: "vapi", name: "AI voice receptionist (Vapi)", required: false, env: [["VAPI_API_KEY", "VAPI_WEBHOOK_SECRET"]], settings: ["vapi_private_key"], test: "Admin → Voice agent: create an assistant, call its number from your phone." },
  { key: "telnyx", name: "Telephony (Telnyx)", required: false, env: [["TELNYX_API_KEY", "TELNYX_PUBLIC_KEY"]], settings: ["telnyx_api_key"], test: "Place one test call; events appear in the audit log." },
  { key: "meta", name: "Instagram / Meta", required: false, env: [["META_APP_ID", "META_APP_SECRET"], ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"]], test: "Social → Connect Instagram with a test business account, then publish one scheduled post." },
  { key: "youtube", name: "YouTube publishing (Video Factory)", required: false, env: [["VIDEO_FACTORY_YOUTUBE_CLIENT_ID", "VIDEO_FACTORY_YOUTUBE_CLIENT_SECRET"]], test: "Video Factory → connect YouTube, publish one private video." },
  { key: "gsc", name: "Google Search Console", required: false, env: [["GOOGLE_SEARCH_CONSOLE_CLIENT_ID"]], test: "SEO → connect Search Console." },
  { key: "google_login", name: "Google sign-in", required: false, env: [["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]], test: "Sign in with Google." },
];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse(req) : unauthorizedResponse(req);
  }

  let database: { ok: boolean; latencyMs: number | null; error: string | null };
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    database = { ok: false, latencyMs: null, error: err instanceof Error ? err.message : String(err) };
  }

  const settingKeys = ["zarinpal_merchant", "zarinpal_sandbox", "vapi_private_key", "telnyx_api_key"];
  const settingValues = new Map(database.ok ? (await prisma.siteSetting.findMany({ where: { key: { in: settingKeys } }, select: { key: true, value: true } })).map((row) => [row.key, row.value]) : []);

  const mem = process.memoryUsage();

  const recentErrors = database.ok
    ? await prisma.errorLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, level: true, source: true, message: true, createdAt: true },
      })
    : [];

  return NextResponse.json({
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
    database,
    integrations: INTEGRATIONS.map((i) => ({
      key: i.key,
      name: i.name,
      required: i.required,
      test: i.test,
      configured: i.env.some((group) => group.every((name) => !!process.env[name])) || (i.settings ?? []).some((key) => !!settingValues.get(key)),
      // Names only, never values: what to add when nothing is configured.
      missing: i.env.some((group) => group.every((name) => !!process.env[name])) || (i.settings ?? []).some((key) => !!settingValues.get(key)) ? [] : i.env[0].filter((name) => !process.env[name]),
      ...(i.key === "zarinpal" ? { mode: (settingValues.get("zarinpal_sandbox") ?? process.env.ZARINPAL_SANDBOX) === "true" ? "sandbox" : "live" } : {}),
    })),
    recentErrors,
    checkedAt: new Date().toISOString(),
  });
}
