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

const INTEGRATIONS: { key: string; name: string; env: string[] }[] = [
  { key: "openai", name: "OpenAI", env: ["OPENAI_API_KEY"] },
  { key: "anthropic", name: "Anthropic (Claude)", env: ["ANTHROPIC_API_KEY"] },
  { key: "cohere", name: "Cohere (embeddings / KB)", env: ["COHERE_API_KEY"] },
  { key: "storage", name: "File storage (R2)", env: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] },
  { key: "email", name: "Email (Resend)", env: ["RESEND_API_KEY"] },
  { key: "sms", name: "SMS (Kavenegar)", env: ["KAVENEGAR_API_KEY"] },
  { key: "zarinpal", name: "Payments (ZarinPal)", env: ["ZARINPAL_MERCHANT_ID"] },
  { key: "vapi", name: "Voice Agent (Vapi)", env: ["VAPI_API_KEY"] },
  { key: "meta", name: "Instagram / Meta", env: ["META_APP_ID", "META_APP_SECRET"] },
  { key: "gsc", name: "Google Search Console", env: ["GOOGLE_SEARCH_CONSOLE_CLIENT_ID"] },
  { key: "google_login", name: "Google sign-in", env: ["GOOGLE_CLIENT_ID"] },
];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }

  let database: { ok: boolean; latencyMs: number | null; error: string | null };
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    database = { ok: false, latencyMs: null, error: err instanceof Error ? err.message : String(err) };
  }

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
      configured: i.env.every((name) => !!process.env[name]),
    })),
    recentErrors,
    checkedAt: new Date().toISOString(),
  });
}
