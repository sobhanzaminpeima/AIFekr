import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

/** Channel details the owner types in. Reference data for the script writer, never instructions. */
export const channelProfileSchema = z.object({
  handle: z.string().trim().max(100).regex(/^@?[\p{L}\p{N}._-]*$/u).default(""),
  name: z.string().trim().max(120).default(""),
  niche: z.string().trim().max(300).default(""),
  audience: z.string().trim().max(500).default(""),
  language: z.enum(["fa", "en", "de", "tr"]).default("fa"),
  tone: z.string().trim().max(300).default(""),
  description: z.string().trim().max(2000).default(""),
  keywords: z.string().trim().max(500).default(""),
}).strict();
export type ChannelProfile = z.infer<typeof channelProfileSchema>;

const empty = channelProfileSchema.parse({});
const fields = (row: ChannelProfile) => ({ handle: row.handle, name: row.name, niche: row.niche, audience: row.audience, language: row.language, tone: row.tone, description: row.description, keywords: row.keywords });

export async function getChannelProfile(userId: string): Promise<ChannelProfile & { saved: boolean }> {
  const row = await prisma.videoFactoryChannelProfile.findUnique({ where: { userId } });
  return row ? { ...channelProfileSchema.parse(fields(row as ChannelProfile)), saved: true } : { ...empty, saved: false };
}

export async function saveChannelProfile(userId: string, input: unknown) {
  const data = channelProfileSchema.parse(input);
  if (data.handle && !data.handle.startsWith("@")) data.handle = "@" + data.handle;
  await prisma.$transaction(async (tx) => {
    await tx.videoFactoryChannelProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await tx.auditLog.create({ data: { actorId: userId, action: "video_factory.channel_profile_saved" } });
  });
  return { ...data, saved: true };
}

/** Only the filled-in fields, so an empty profile adds nothing to the writer's context. */
export function channelContext(profile: ChannelProfile & { saved?: boolean }) {
  if (!profile.saved) return null;
  const entries = Object.entries(fields(profile)).filter(([, value]) => value);
  return entries.length ? Object.fromEntries(entries) : null;
}
