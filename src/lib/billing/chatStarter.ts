import { prisma } from "@/lib/db/prisma";
import defaults from "./chat-starter.json";
export const CHAT_STARTER = "CHAT_STARTER_30";
/** Initial catalog entry only. Subsequent price and entitlement edits belong to admin. */
export async function ensureChatStarter() {
  return prisma.package.upsert({where:{planCode:CHAT_STARTER},update:{},create:defaults});
}
