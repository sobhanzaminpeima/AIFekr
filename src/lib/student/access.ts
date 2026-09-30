import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

const SETTING_KEY = "student_workspace_enabled";

/** Defaults on so the additive module does not lock out existing accounts. */
export async function isStudentWorkspaceEnabled(): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
  return setting?.value !== "false";
}

export async function setStudentWorkspaceEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
}

export async function studentWorkspaceDisabledResponse(): Promise<NextResponse | null> {
  if (await isStudentWorkspaceEnabled()) return null;
  return NextResponse.json({ error: "فضای دانشجویی موقتاً غیرفعال است" }, { status: 503 });
}
