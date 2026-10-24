import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { assertAdminMayManage, AdminPermissionError, AdminValidationError } from "./adminRepository";

// Integration test against the isolated vitest DB; rows are scoped to this file.
const stamp = `admin-rbac-${Date.now()}`;
const ids = { admin: `${stamp}-admin`, other: `${stamp}-other`, superA: `${stamp}-super`, customer: `${stamp}-customer` };

beforeAll(async () => {
  await prisma.user.createMany({ data: [
    { id: ids.admin, role: "ADMIN" },
    { id: ids.other, role: "ADMIN" },
    { id: ids.superA, role: "SUPER_ADMIN" },
    { id: ids.customer, role: "USER", credits: 10 },
  ] });
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }); });

const admin = { id: ids.admin, role: "ADMIN" };
const superAdmin = { id: ids.superA, role: "SUPER_ADMIN" };

describe("assertAdminMayManage", () => {
  it("lets an ADMIN manage a customer's ordinary fields", async () => {
    await expect(assertAdminMayManage(admin, ids.customer, { credits: 50, isBlocked: true, name: "x" })).resolves.toMatchObject({ role: "USER" });
  });
  it("refuses role changes by an ADMIN, including promoting themselves", async () => {
    await expect(assertAdminMayManage(admin, ids.admin, { role: "SUPER_ADMIN" })).rejects.toBeInstanceOf(AdminPermissionError);
    await expect(assertAdminMayManage(admin, ids.customer, { role: "ADMIN" })).rejects.toBeInstanceOf(AdminPermissionError);
  });
  it("allows an unchanged role field to pass through a full-form save", async () => {
    await expect(assertAdminMayManage(admin, ids.customer, { role: "USER", name: "y" })).resolves.toBeTruthy();
  });
  it("refuses any ADMIN action on a SUPER_ADMIN account", async () => {
    await expect(assertAdminMayManage(admin, ids.superA, { name: "x" })).rejects.toBeInstanceOf(AdminPermissionError);
  });
  it("refuses deletes by an ADMIN and self-deletes by a SUPER_ADMIN", async () => {
    await expect(assertAdminMayManage(admin, ids.customer, null)).rejects.toBeInstanceOf(AdminPermissionError);
    await expect(assertAdminMayManage(superAdmin, ids.superA, null)).rejects.toBeInstanceOf(AdminPermissionError);
    await expect(assertAdminMayManage(superAdmin, ids.customer, null)).resolves.toBeTruthy();
  });
  it("lets a SUPER_ADMIN change roles, but not their own or to an unknown role", async () => {
    await expect(assertAdminMayManage(superAdmin, ids.other, { role: "USER" })).resolves.toBeTruthy();
    await expect(assertAdminMayManage(superAdmin, ids.superA, { role: "USER" })).rejects.toBeInstanceOf(AdminPermissionError);
    await expect(assertAdminMayManage(superAdmin, ids.other, { role: "OWNER" })).rejects.toBeInstanceOf(AdminValidationError);
  });
  it("rejects malformed credits and blocked values", async () => {
    for (const credits of [-1, 1.5, "100", null]) await expect(assertAdminMayManage(admin, ids.customer, { credits })).rejects.toBeInstanceOf(AdminValidationError);
    await expect(assertAdminMayManage(admin, ids.customer, { isBlocked: "yes" })).rejects.toBeInstanceOf(AdminValidationError);
    await expect(assertAdminMayManage(admin, ids.admin, { isBlocked: true })).rejects.toBeInstanceOf(AdminPermissionError);
  });
});
