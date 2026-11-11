import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretBox";

/**
 * SMS provider settings, edited by admins in the panel instead of the server's
 * environment. The API key is stored encrypted and never returned; the admin
 * only sees whether one is set and its last four characters. With no saved
 * row, the older environment variables still work (SMSIR_API_KEY, SMSIR_LINE_NUMBER).
 */
export const SMS_SETTING = "smsProvider";

const schema = z.object({
  provider: z.literal("smsir").default("smsir"),
  apiKey: z.string().max(400).default(""),
  lineNumber: z.string().regex(/^\d{0,20}$/).default(""),
  /** The verify (OTP) template's id as the provider's API knows it. */
  otpTemplateId: z.string().max(60).default(""),
  /** The template's placeholder that receives the code, e.g. CODE. */
  otpParam: z.string().regex(/^[A-Za-z0-9_]{1,40}$/).default("CODE"),
}).strict();

export type SmsConfig = z.infer<typeof schema> & { source: "admin" | "env" | "none" };

export async function getSmsConfig(): Promise<SmsConfig> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SMS_SETTING } }).catch(() => null);
  if (row) {
    const parsed = schema.parse(JSON.parse(row.value));
    return { ...parsed, apiKey: parsed.apiKey ? decryptSecret(parsed.apiKey) : "", source: "admin" };
  }
  const apiKey = process.env.SMSIR_API_KEY || "", lineNumber = process.env.SMSIR_LINE_NUMBER || "";
  return { provider: "smsir", apiKey, lineNumber, otpTemplateId: process.env.SMSIR_OTP_TEMPLATE_ID || "", otpParam: process.env.SMSIR_OTP_PARAM || "CODE", source: apiKey ? "env" : "none" };
}

/** What an admin may see: never the key itself. */
export function publicSmsConfig(c: SmsConfig) {
  return {
    provider: c.provider,
    configured: !!c.apiKey,
    keyHint: c.apiKey ? "…" + c.apiKey.slice(-4) : null,
    lineNumber: c.lineNumber,
    otpTemplateId: c.otpTemplateId,
    otpParam: c.otpParam,
    source: c.source,
  };
}

/** Saves the settings; an empty apiKey keeps the stored one. */
export async function saveSmsConfig(input: unknown) {
  const next = schema.parse(input);
  const old = await getSmsConfig();
  const apiKey = next.apiKey.trim() || old.apiKey;
  const stored = { ...next, apiKey: apiKey ? encryptSecret(apiKey) : "" };
  await prisma.siteSetting.upsert({ where: { key: SMS_SETTING }, create: { key: SMS_SETTING, value: JSON.stringify(stored) }, update: { value: JSON.stringify(stored) } });
  return publicSmsConfig({ ...next, apiKey, source: "admin" });
}
