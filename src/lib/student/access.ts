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
  if(!user)return false;
  const account=await prisma.user.findUnique({where:{id:user.id},select:{accountType:true,plan:true,planExpiry:true,isBlocked:true}});
  if(!account||account.isBlocked||account.accountType!=="STUDENT"||!account.plan.startsWith("STUDENT_")||!account.planExpiry||account.planExpiry.getTime()<=Date.now())return false;
  const [override,setting]=await Promise.all([
    prisma.userModuleOverride.findUnique({where:{userId_moduleKey:{userId:user.id,moduleKey:STUDENT_WORKSPACE_MODULE_KEY}},select:{enabled:true}}),
    prisma.siteSetting.findUnique({where:{key:SETTING_KEY},select:{value:true}}),
  ]);
  return override?.enabled??setting?.value!=="false";
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
  return NextResponse.json({ error: "ایجنت دانشجویی به حساب دانشجویی و پکیج دانشجویی فعال نیاز دارد." }, { status: 403 });
}
