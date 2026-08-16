import { prisma } from "@/lib/db/prisma";

/**
 * Single choke point for creating in-app notifications. Deliberately dumb —
 * callers decide what happened and how to phrase it, this just persists the
 * row. Never throws into the caller's flow; failures here must not block the
 * real work (a lead being created, a call being logged, a post publishing).
 */
export async function notify(
  userId: string,
  { type, title, body, link }: { type: string; title: string; body?: string; link?: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body: body || undefined, link: link || undefined },
    });
  } catch (e) {
    console.error("notify() failed:", e);
  }
}
