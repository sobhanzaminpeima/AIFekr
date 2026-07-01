import { cookies } from "next/headers";
import en from "./en";
import fa from "./fa";
import { prisma } from "@/lib/db/prisma";

export type Lang = "fa" | "en";

export async function getServerLang(): Promise<Lang> {
  try {
    const cookieStore = await cookies();
    const lang = cookieStore.get("lang")?.value;
    if (lang === "en" || lang === "fa") return lang;
  } catch {}
  // Fallback to DB default_language setting
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: "default_language" } });
    if (setting?.value === "en" || setting?.value === "fa") return setting.value as Lang;
  } catch {}
  return "fa";
}

export async function getServerT() {
  const lang = await getServerLang();
  return { t: lang === "en" ? en : fa, lang };
}

export async function getSiteSetting(key: string, defaultValue = ""): Promise<string> {
  try {
    const s = await prisma.siteSetting.findUnique({ where: { key } });
    return s?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}
