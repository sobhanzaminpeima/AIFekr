import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

const SETTING_KEY = "student_workspace_enabled";
export const STUDENT_WORKSPACE_MODULE_KEY = "student.workspace";

export interface StudentAccessUser {
  id: string;
  role?: string;
}

/**
 * The site setting is the default for accounts without an explicit override.
 * Per-user overrides let admins enable/disable the module for one account.
 */
export async function isStudentWorkspaceEnabled(user?: StudentAccessUser): Promise<boolean> {
  if (user) {
    const override = await prisma.userModuleOverride.findUnique({
      where: { userId_moduleKey: { userId: user.id, moduleKey: STUDENT_WORKSPACE_MODULE_KEY } },
      select: { enabled: true },
    });
    if (override) return override.enabled;
  }

  const setting = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
  // Defaults on so the additive module does not lock out existing accounts.
  return setting?.value !== "false";
}

export async function setStudentWorkspaceEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
}

export async function studentWorkspaceDisabledResponse(user?: StudentAccessUser): Promise<NextResponse | null> {
  if (await isStudentWorkspaceEnabled(user)) return null;
  return NextResponse.json({ error: "فضای دانشجویی موقتاً غیرفعال است" }, { status: 503 });
}
