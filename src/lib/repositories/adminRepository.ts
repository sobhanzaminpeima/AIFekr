import { prisma } from "@/lib/db/prisma";

/**
 * Centralizes admin-privileged mutations of arbitrary users. Every function here
 * is only ever safe to call after requireAdmin() has already run in the route —
 * this file does not re-check admin status itself, it exists to keep the
 * "which fields can an admin touch" allowlist in one place instead of duplicated
 * inline in each admin route.
 */

const ADMIN_EDITABLE_USER_FIELDS = ["name", "email", "plan", "credits", "isBlocked", "planExpiry", "role", "crmPlan", "crmPlanExpiry"] as const;

export function updateUserAsAdmin(userId: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ADMIN_EDITABLE_USER_FIELDS) {
    if (key in body) data[key] = body[key];
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
