import { prisma } from "@/lib/db/prisma";

/**
 * Creating an account with a mobile number (SMS code), owner decision 2026-11-06:
 * off "for now" -- new accounts sign up by email and password only. Accounts that
 * already have a number keep logging in with it. SiteSetting `phoneSignup` =
 * {"enabled": boolean}; a missing or unreadable row means OFF.
 */
export const PHONE_SIGNUP_KEY = "phoneSignup";

export async function phoneSignupEnabled(): Promise<boolean> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: PHONE_SIGNUP_KEY } });
    return row ? JSON.parse(row.value)?.enabled === true : false;
  } catch {
    return false;
  }
}

export const PHONE_SIGNUP_OFF = {
  fa: "با این شماره حسابی ثبت نشده است. لطفاً با ایمیل ثبت‌نام کنید.",
  en: "There's no account with this number. Please sign up with your email.",
  de: "Mit dieser Nummer gibt es kein Konto. Bitte registrieren Sie sich mit Ihrer E-Mail.",
  tr: "Bu numarayla kayıtlı bir hesap yok. Lütfen e-postanla kaydol.",
} as const;
