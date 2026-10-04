import { hasBusinessBundle } from "@/lib/plans/businessAccess";
import { getModule } from "./moduleRegistry";
import { prisma } from "@/lib/db/prisma";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";
import { hasVoiceAccess } from "@/lib/voice/workspace";
import { featureAccessExpired } from "@/lib/subscriptions/access";

/**
 * Single decision point for "is this CRM module / agent visible to this user".
 * Priority order (fixed, do not reorder — confirmed with product owner):
 *   1. platform admin (ADMIN | SUPER_ADMIN) -> always true, bypasses everything.
 *   2. a UserModuleOverride row for (userId, moduleKey) -> its value is authoritative.
 *   3. active paid business bundle -> registered capabilities enabled.
 *   4. the user's industry pack's IndustryModuleFlag for (industryPackId, moduleKey) -> its value is authoritative.
 *   5. no pack, or no matching flag row -> false (fail-safe hidden, never fail-open).
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
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiry: true, trialEndsAt: true, voicePlan: true, voicePlanExpiry: true } });
  if (!account || featureAccessExpired(account)) return false;
  if (moduleKey === "student.workspace") return isStudentWorkspaceEnabled(user);
  if (moduleKey === "agent.voiceCallCenter") return hasVoiceAccess(account);

  const override = await prisma.userModuleOverride.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey } },
  });
  if (override) return override.enabled;

  if (getModule(moduleKey) && await hasBusinessBundle(user.id)) return true;

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

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiry: true, trialEndsAt: true, voicePlan: true, voicePlanExpiry: true } });
  if (!account || featureAccessExpired(account)) return Object.fromEntries(moduleKeys.map(k => [k, false]));
  const student = moduleKeys.includes("student.workspace") ? await isStudentWorkspaceEnabled(user) : false;
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

  const bundled = await hasBusinessBundle(user.id);
  const overrideMap = new Map(overrides.map((o) => [o.moduleKey, o.enabled]));
  const flagMap = new Map(flags.map((f) => [f.moduleKey, f.enabled]));

  const result: Record<string, boolean> = {};
  for (const key of moduleKeys) {
    if (key === "student.workspace") { result[key] = student; continue; }
    if (key === "agent.voiceCallCenter") { result[key] = hasVoiceAccess(account); continue; }
    if (overrideMap.has(key)) {
      result[key] = overrideMap.get(key)!;
    } else if (bundled && getModule(key)) {
      result[key] = true;
    } else if (flagMap.has(key)) {
      result[key] = flagMap.get(key)!;
    } else {
      result[key] = false;
    }
  }
  return result;
}
