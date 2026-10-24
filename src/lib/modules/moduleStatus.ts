import { prisma } from "@/lib/db/prisma";
import { BLOCKING_MODULE_STATUSES } from "./moduleRoutes";

const TTL_MS = 30_000;
let cache: { at: number; blocked: Record<string, string> } | null = null;

/**
 * Module keys an admin has taken away from users, with their status
 * ("disabled" | "maintenance"). Cached for 30s because the proxy calls this
 * on every page and API request; an admin change therefore reaches users
 * within half a minute. A registry read failure never blocks anything.
 */
export async function blockedModules(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.blocked;
  try {
    const rows = await prisma.moduleRegistry.findMany({
      where: { status: { in: [...BLOCKING_MODULE_STATUSES] }, isCore: false },
      select: { key: true, status: true },
    });
    cache = { at: Date.now(), blocked: Object.fromEntries(rows.map((row) => [row.key, row.status])) };
  } catch {
    cache = { at: Date.now(), blocked: cache?.blocked ?? {} };
  }
  return cache.blocked;
}
