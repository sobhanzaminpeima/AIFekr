import { NextResponse } from "next/server";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

/** Where a visitor without fitness access picks and pays for a fitness package, inside the platform. */
export const FITNESS_PLANS_URL = "/plans?category=FITNESS";

/**
 * The answer for a fitness feature the account has no package for: a sentence
 * in the visitor's language (it is shown as is), the stable code for clients
 * that branch on it, and the in-platform page to activate a package.
 */
export async function fitnessRequired() {
  const lang = await getServerLang();
  return NextResponse.json({
    error: tri(lang, "این بخش به پکیج فعال فیتنس آی‌فکر نیاز دارد. یک پکیج فیتنس انتخاب و فعال کنید.", "This part needs an active AIFekr FIT package. Choose and activate a fitness package.", "Dieser Bereich braucht ein aktives AIFekr-FIT-Paket. Wählen und aktivieren Sie ein Fitnesspaket.", "Bu bölüm etkin bir AIFekr FIT paketi gerektirir. Bir fitness paketi seçip etkinleştirin."),
    code: "FITNESS_SUBSCRIPTION_REQUIRED",
    renewUrl: FITNESS_PLANS_URL,
  }, { status: 402 });
}
