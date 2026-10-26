import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secretBox";
import { settingsSchema, defaults, VoiceError } from "./domain";
export async function voicePolicy() { const row = await prisma.siteSetting.findUnique({ where: { key: "voiceStudioSettings" } }); return row ? settingsSchema.parse(JSON.parse(row.value)) : defaults; }
export async function voiceCredentials() { const row = await prisma.siteSetting.findUnique({ where: { key: "voiceStudioSecret" } }); const key = row ? decryptSecret(row.value) : process.env.ELEVENLABS_API_KEY; if (!key)
    throw new VoiceError("ELEVENLABS_NOT_CONFIGURED", 503); const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io/v1").replace(/\/$/, ""); const url = new URL(base); if (url.protocol !== "https:" || url.username || url.password)
    throw new VoiceError("INVALID_PROVIDER_BASE", 503); return { key, base }; }
export async function saveVoiceSettings(actorId: string, value: unknown, secret?: string) { const old = await voicePolicy(), next = settingsSchema.parse(value); next.version = old.version + 1; if (Object.keys(next.modelUsdPer1k).length && (!next.priceVerifiedAt || !next.priceSource))
    throw new VoiceError("PRICING_SOURCE_REQUIRED", 400); await prisma.$transaction(async (tx) => { await tx.siteSetting.upsert({ where: { key: "voiceStudioSettings" }, create: { key: "voiceStudioSettings", value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } }); if (secret) {
    await tx.siteSetting.upsert({ where: { key: "voiceStudioSecret" }, create: { key: "voiceStudioSecret", value: encryptSecret(secret) }, update: { value: encryptSecret(secret) } });
    await tx.siteSetting.deleteMany({ where: { key: "voiceStudioCatalog" } });
} await tx.auditLog.create({ data: { actorId, action: "voice_studio.settings_updated", metadata: JSON.stringify({ version: next.version, enabled: next.enabled, credentialChanged: !!secret }) } }); }); return next; }
