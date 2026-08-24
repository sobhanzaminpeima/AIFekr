import { prisma } from "@/lib/db/prisma";

/**
 * Single decision point for "is this CRM module / agent visible to this user".
 * Priority order (fixed, do not reorder — confirmed with product owner):
 *   1. platform admin (ADMIN | SUPER_ADMIN) -> always true, bypasses everything.
 *   2. a UserModuleOverride row for (userId, moduleKey) -> its value is authoritative.
 *   3. the user's industry pack's IndustryModuleFlag for (industryPackId, moduleKey) -> its value is authoritative.
 *   4. no pack, or no matching flag row -> false (fail-safe hidden, never fail-open).
 *
 * No caching layer on purpose: every check is a cheap indexed read, and this
 * avoids the entire "admin changed a flag but the customer still sees stale
 * state" class of bug.
 */

export interface ModuleAccessUser {
  id: string;
  role: string;
  industryPackId: string | null;
}

function isPlatformAdmin(user: ModuleAccessUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

export async function isModuleEnabled(user: ModuleAccessUser, moduleKey: string): Promise<boolean> {
  if (isPlatformAdmin(user)) return true;

  const override = await prisma.userModuleOverride.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey } },
  });
  if (override) return override.enabled;

  if (!user.industryPackId) return false;

  const flag = await prisma.industryModuleFlag.findUnique({
    where: { industryPackId_moduleKey: { industryPackId: user.industryPackId, moduleKey } },
  });
  if (flag) return flag.enabled;

  return false;
}

/**
 * Batch variant for rendering a nav/sidebar without N round trips — returns
 * a map of moduleKey -> enabled for every key in `moduleKeys`, applying the
 * exact same priority order as isModuleEnabled() per key.
 */
export async function getModuleAccessMap(
  user: ModuleAccessUser,
  moduleKeys: string[]
): Promise<Record<string, boolean>> {
  if (isPlatformAdmin(user)) {
    return Object.fromEntries(moduleKeys.map((k) => [k, true]));
  }

  const [overrides, flags] = await Promise.all([
    prisma.userModuleOverride.findMany({
      where: { userId: user.id, moduleKey: { in: moduleKeys } },
    }),
    user.industryPackId
      ? prisma.industryModuleFlag.findMany({
          where: { industryPackId: user.industryPackId, moduleKey: { in: moduleKeys } },
        })
      : Promise.resolve([]),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.moduleKey, o.enabled]));
  const flagMap = new Map(flags.map((f) => [f.moduleKey, f.enabled]));

  const result: Record<string, boolean> = {};
  for (const key of moduleKeys) {
    if (overrideMap.has(key)) {
      result[key] = overrideMap.get(key)!;
    } else if (flagMap.has(key)) {
      result[key] = flagMap.get(key)!;
    } else {
      result[key] = false;
    }
  }
  return result;
}
