import { decryptSecret } from "@/lib/crypto/secretBox";
import { prisma } from "@/lib/db/prisma";

export async function voiceSettings() {
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: "vapi_" } } });
  const s = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const positive = (key: string, fallback: number, max: number) => {
    const n = Number(s[key]);
    return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
  };
  return {
    apiKey: decryptSecret(s.vapi_private_key || process.env.VAPI_API_KEY || ""),
    webhookSecret: decryptSecret(s.vapi_webhook_secret || process.env.VAPI_WEBHOOK_SECRET || ""),
    credentialId: s.vapi_credential_id || process.env.VAPI_CREDENTIAL_ID || "",
    model: s.vapi_model || "gpt-4o-mini",
    voiceId: s.vapi_voice_id || "21m00Tcm4TlvDq8ikWAM",
    creditsPerMinute: positive("vapi_credits_per_minute", 10, 10000),
    maxDurationSeconds: positive("vapi_max_duration_seconds", 300, 1800),
  };
}
