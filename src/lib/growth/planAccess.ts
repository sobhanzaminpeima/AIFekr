import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { getLimitsForPlan } from "@/lib/utils/planLimits";

/**
 * Which media tools the account's plan allows, decided by exactly the checks
 * the generate routes make (video/generate: a limited referral trial or a
 * monthly video limit of 0; music/generate: a monthly music limit of 0). The
 * create pages show it before the user writes a prompt, instead of the user
 * learning it from a refusal after pressing generate. Nothing is granted here.
 */
export async function mediaPlanAccess(user: { plan: string; trialLimited?: boolean | null }) {
  const limits = await getLimitsForPlan(user.plan);
  return { video: !user.trialLimited && limits.monthlyVideos !== 0, music: limits.monthlyMusics !== 0 };
}

/** The create pages' notice for a tool outside the plan. */
export function planNoticeCopy(lang: Lang) {
  return {
    videoTitle: tri(lang, "ساخت ویدیو در پلن فعلی شما نیست", "Video generation isn't included in your current plan", "Videoerstellung ist in Ihrem aktuellen Tarif nicht enthalten", "Video oluşturma mevcut planınıza dahil değil"),
    musicTitle: tri(lang, "ساخت موسیقی در پلن فعلی شما نیست", "Music generation isn't included in your current plan", "Musikerstellung ist in Ihrem aktuellen Tarif nicht enthalten", "Müzik oluşturma mevcut planınıza dahil değil"),
    body: tri(lang, "با اعتبار فعلی‌ات همین حالا می‌توانی تصویر بسازی یا با هوش مصنوعی گفت‌وگو کنی. برای این ابزار، پکیج‌ها را ببین.", "You can create images or chat with the AI right now with your current credits. For this tool, see the packages.", "Mit Ihren aktuellen Credits können Sie sofort Bilder erstellen oder mit der KI chatten. Für dieses Werkzeug sehen Sie sich die Pakete an.", "Mevcut kredilerinizle hemen görsel oluşturabilir veya yapay zekâ ile sohbet edebilirsiniz. Bu araç için paketlere göz atın."),
    createImage: tri(lang, "ساخت تصویر", "Create an image", "Bild erstellen", "Görsel oluştur"),
    packages: tri(lang, "مشاهدهٔ پکیج‌ها", "See packages", "Pakete ansehen", "Paketleri gör"),
  };
}
