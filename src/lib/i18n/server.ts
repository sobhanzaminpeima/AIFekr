import { cookies } from "next/headers";
import en from "./en";
import fa from "./fa";
import de from "./de";
import { prisma } from "@/lib/db/prisma";

export type Lang = "fa" | "en" | "de";

const TRANSLATIONS: Record<Lang, typeof en> = { en, fa, de: de as typeof en };

function isLang(v: string | undefined): v is Lang {
  return v === "en" || v === "fa" || v === "de";
}

export async function getServerLang(): Promise<Lang> {
  try {
    const cookieStore = await cookies();
    const lang = cookieStore.get("lang")?.value;
    if (isLang(lang)) return lang;
  } catch {}
  // Fallback to DB default_language setting
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: "default_language" } });
    if (isLang(setting?.value)) return setting!.value as Lang;
  } catch {}
  return "fa";
}

export async function getServerT() {
  const lang = await getServerLang();
  return { t: TRANSLATIONS[lang], lang };
}

export async function getSiteSetting(key: string, defaultValue = ""): Promise<string> {
  try {
    const s = await prisma.siteSetting.findUnique({ where: { key } });
    return s?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}
