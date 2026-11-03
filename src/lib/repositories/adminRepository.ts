import { recordLedger } from "@/lib/credits/ledger";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Centralizes admin-privileged mutations of arbitrary users. Every function here
 * is only ever safe to call after requireAdmin() has already run in the route —
 * this file does not re-check admin status itself, it exists to keep the
 * "which fields can an admin touch" allowlist in one place instead of duplicated
 * inline in each admin route.
 */

const ADMIN_EDITABLE_USER_FIELDS = ["accountType", "name", "firstName", "lastName", "country", "currency", "email", "phone", "plan", "credits", "isBlocked", "planExpiry", "role", "crmPlan", "crmPlanExpiry", "commissionPercentOverride"] as const;

const USER_ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const;

/** Thrown when an admin tries an action their own role does not allow. */
export class AdminPermissionError extends Error {}
/** Thrown for a field value of the wrong type or range. */
export class AdminValidationError extends Error {}

type AdminActor = { id: string; role: string };

/**
 * Privilege rules for editing another account. A plain ADMIN can manage
 * customers, but changing anyone's role, touching a SUPER_ADMIN account or
 * deleting an account is SUPER_ADMIN-only — otherwise any admin could promote
 * themselves and take over the platform.
 */
export async function assertAdminMayManage(actor: AdminActor, targetId: string, body: Record<string, unknown> | null) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, credits: true } });
  if (!target) throw new AdminValidationError("USER_NOT_FOUND");
  const isSuper = actor.role === "SUPER_ADMIN";
  if (target.role === "SUPER_ADMIN" && !isSuper) throw new AdminPermissionError("SUPER_ADMIN_REQUIRED");
  if (body === null) {
    if (!isSuper) throw new AdminPermissionError("SUPER_ADMIN_REQUIRED");
    if (actor.id === targetId) throw new AdminPermissionError("CANNOT_DELETE_SELF");
    return target;
  }
  if ("role" in body && body.role !== target.role) {
    if (!isSuper) throw new AdminPermissionError("SUPER_ADMIN_REQUIRED");
    if (!USER_ROLES.includes(body.role as (typeof USER_ROLES)[number])) throw new AdminValidationError("INVALID_ROLE");
    if (actor.id === targetId) throw new AdminPermissionError("CANNOT_CHANGE_OWN_ROLE");
  }
  if ("credits" in body && (!Number.isSafeInteger(body.credits) || Number(body.credits) < 0)) throw new AdminValidationError("INVALID_CREDITS");
  if ("isBlocked" in body && typeof body.isBlocked !== "boolean") throw new AdminValidationError("INVALID_BLOCKED");
  if ("isBlocked" in body && body.isBlocked === true && actor.id === targetId) throw new AdminPermissionError("CANNOT_BLOCK_SELF");
  if ("commissionPercentOverride" in body && body.commissionPercentOverride !== null && (typeof body.commissionPercentOverride !== "number" || body.commissionPercentOverride < 0 || body.commissionPercentOverride > 100)) throw new AdminValidationError("INVALID_COMMISSION");
  return target;
}

export class PhoneAlreadyInUseError extends Error {
  constructor() {
    super("این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است");
  }
}

/** Admin credit changes need a short written reason; it goes to the credit ledger and the audit log. */
function creditReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new AdminValidationError("CREDIT_REASON_REQUIRED");
  return reason;
}

/**
 * Applies an admin credit change as a delta in one guarded statement, so a
 * spend that lands at the same moment is never overwritten (an absolute
 * "set to N" computed from a stale page could erase it). A legacy absolute
 * value is accepted only if the balance is still the one it was based on.
 */
async function applyAdminCredits(tx: Prisma.TransactionClient, userId: string, actorId: string | null, body: Record<string, unknown>) {
  let delta: number, where: Prisma.UserWhereInput = { id: userId };
  if ("creditDelta" in body) {
    delta = Number(body.creditDelta);
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100_000_000) throw new AdminValidationError("INVALID_CREDIT_DELTA");
    if (delta < 0) where = { ...where, credits: { gte: -delta } };
  } else {
    const target = Number(body.credits);
    const current = (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } })).credits;
    delta = target - current;
    if (!delta) return;
    where = { ...where, credits: current };
  }
  const reason = creditReason(body.creditReason ?? ("creditDelta" in body ? undefined : "Balance set in admin panel"));
  const { count } = await tx.user.updateMany({ where, data: { credits: { increment: delta } } });
  if (!count) throw new AdminValidationError(delta < 0 ? "INSUFFICIENT_CREDITS" : "CREDITS_CHANGED");
  await recordLedger(tx, { userId, delta, type: "ADMIN_ADJUSTMENT", actorId, reason });
}

export async function updateUserAsAdmin(userId: string, body: Record<string, unknown>, actorId: string | null = null) {
  if(body.accountType!==undefined&&!["PERSONAL","STUDENT","BUSINESS"].includes(String(body.accountType)))throw new Error("INVALID_ACCOUNT_TYPE");
  const data: Record<string, unknown> = {};
  for (const key of ADMIN_EDITABLE_USER_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  // A paid plan with no expiry is treated as FREE by every subscription gate.
  // Give a newly assigned plan one month when the form omitted a valid term.
  if (typeof data.plan === "string" && data.plan !== "FREE") {
    const current = await prisma.user.findUniqueOrThrow({where:{id:userId},select:{plan:true,planExpiry:true}});
    if (current.plan !== data.plan || !current.planExpiry) {
      const expiry = data.planExpiry instanceof Date ? data.planExpiry : current.planExpiry;
      if (!expiry || expiry <= new Date()) data.planExpiry = new Date(Date.now() + 30 * 86400000);
    }
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
  const rest = { ...data };
  delete rest.credits;
  return prisma.$transaction(async (tx) => {
    if ("credits" in body || "creditDelta" in body) await applyAdminCredits(tx, userId, actorId, body);
    return tx.user.update({ where: { id: userId }, data: rest });
  });
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
