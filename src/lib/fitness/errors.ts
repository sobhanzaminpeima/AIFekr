import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";

/**
 * A coach or program can only be saved on an existing fitness profile, and the
 * profile cannot be created implicitly: age, goal and the health-data consent
 * come from the person (production 2026-11-09: choosing a coach first showed
 * "Invalid prisma.fitnessProfile.update() invocation" to the user).
 */
export const fitnessProfileRequired = (lang: Lang) => ({
  error: tri(lang, "اول پروفایل ورزشی‌ات را کامل کن؛ بعد می‌توانی مربی انتخاب کنی.", "Complete your fitness profile first; then you can choose a coach.", "Vervollständigen Sie zuerst Ihr Fitnessprofil; danach können Sie einen Coach wählen.", "Önce fitness profilini tamamla; sonra koç seçebilirsin."),
  code: "FITNESS_PROFILE_REQUIRED",
});

/** What a failed fitness request may show the user: the service's own message, never a database or validation dump. */
export function publicFitnessError(error: unknown, lang: Lang) {
  const internal = !(error instanceof Error) || error.name === "ZodError" || error.name.startsWith("PrismaClient") || /prisma\.|invocation/i.test(error.message);
  if (!internal) return (error as Error).message;
  return tri(lang, "درخواست انجام نشد؛ لطفاً دوباره تلاش کنید.", "That didn't work; please try again.", "Das hat nicht geklappt; bitte erneut versuchen.", "İşlem yapılamadı; lütfen tekrar dene.");
}
