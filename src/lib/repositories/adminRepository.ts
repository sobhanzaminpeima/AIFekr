import { prisma } from "@/lib/db/prisma";

/**
 * Centralizes admin-privileged mutations of arbitrary users. Every function here
 * is only ever safe to call after requireAdmin() has already run in the route —
 * this file does not re-check admin status itself, it exists to keep the
 * "which fields can an admin touch" allowlist in one place instead of duplicated
 * inline in each admin route.
 */

const ADMIN_EDITABLE_USER_FIELDS = ["name", "firstName", "lastName", "country", "currency", "email", "phone", "plan", "credits", "isBlocked", "planExpiry", "role", "crmPlan", "crmPlanExpiry", "commissionPercentOverride"] as const;

export class PhoneAlreadyInUseError extends Error {
  constructor() {
    super("این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است");
  }
}

export async function updateUserAsAdmin(userId: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ADMIN_EDITABLE_USER_FIELDS) {
    if (key in body) data[key] = body[key];
  }

  if (typeof data.phone === "string") {
    const trimmed = data.phone.trim();
    data.phone = trimmed || null;
    if (trimmed) {
      const clash = await prisma.user.findUnique({ where: { phone: trimmed }, select: { id: true } });
      if (clash && clash.id !== userId) throw new PhoneAlreadyInUseError();
    }
  }
  // Keep the legacy `name` column in sync when an admin edits first/last
  // name specifically -- every existing caller elsewhere in the app still
  // reads user.name, so it can't just go stale the moment these are split out.
  if ("firstName" in body || "lastName" in body) {
    const first = typeof data.firstName === "string" ? data.firstName : undefined;
    const last = typeof data.lastName === "string" ? data.lastName : undefined;
    if (first !== undefined || last !== undefined) {
      data.name = [first, last].filter((s) => s && s.trim()).join(" ") || undefined;
    }
  }
  return prisma.user.update({ where: { id: userId }, data });
}

export function deleteUserAsAdmin(userId: string) {
  return prisma.user.delete({ where: { id: userId } });
}

const VALID_ROLES = ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role);
}

export function setUserRoleAsAdmin(userId: string, role: UserRole) {
  return prisma.user.update({ where: { id: userId }, data: { role } });
}
