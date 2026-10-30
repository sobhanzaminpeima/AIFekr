import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { BLOCKING_MODULE_STATUSES } from "@/lib/modules/moduleRoutes";
import { growthFlag } from "./config";
import { GROWTH_MODULES, INTENTS, moduleEntry, OBJECTIVES, PERSONAS, parseGoals, recommendModules, type GrowthModule } from "./modules";

/** Modules an admin has not disabled; onboarding never recommends an unavailable module. */
export async function availableModules() {
  const blocked = new Set((await prisma.moduleRegistry.findMany({ where: { status: { in: [...BLOCKING_MODULE_STATUSES] } }, select: { key: true } })).map(m => m.key));
  return GROWTH_MODULES.filter(m => !m.registryKey || !blocked.has(m.registryKey));
}

const recView = (m: GrowthModule) => ({ id: m.id, name: m.name, path: moduleEntry(m), firstValue: m.firstValue, exampleTask: m.exampleTask });

/**
 * Accounts that keep the established welcome wizard: plan purchases (its
 * checkout routing), student and fitness accounts, or smart onboarding off.
 */
export async function usesLegacyWelcome(user: { accountType: string | null }, planChosen: boolean) {
  return planChosen || ["STUDENT", "FITNESS"].includes(user.accountType ?? "") || !(await growthFlag("smart_onboarding_enabled"));
}

/** The onboarding answers, options and recommendations for one account. */
export async function onboardingView(user: { id: string; credits: number; accountType: string | null }) {
  const modules = await availableModules();
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id } });
  const goals = parseGoals(profile?.goals || profile?.objective);
  const recs = recommendModules(goals, m => modules.includes(m));
  return {
    enabled: true, credits: user.credits, accountType: user.accountType,
    state: profile?.onboardingState ?? "not_started", step: profile?.onboardingStep ?? 0,
    answers: { goals, objective: goals[0] ?? null, persona: profile?.persona ?? null, intent: profile?.intent ?? null },
    options: { objectives: OBJECTIVES.filter(o => modules.some(m => m.objectives.includes(o.id))), personas: PERSONAS, intents: INTENTS },
    recommendation: recs[0] ? recView(recs[0]) : null,
    recommendations: recs.map(recView),
  };
}

/** Event that records "not now" on the home invitation; the invitation is never shown again after it. */
export const INVITE_DISMISSED = "onboarding_invite_dismissed";

/**
 * The home page's optional invitation to personalize: only for an account
 * that has no goals yet and has not finished or declined it. Never a redirect.
 */
export async function personalizeInvite(user: { id: string; accountType: string | null }) {
  if (await usesLegacyWelcome(user, false)) return false;
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { goals: true, objective: true, onboardingState: true } });
  if (parseGoals(profile?.goals || profile?.objective).length || profile?.onboardingState === "completed") return false;
  return !(await prisma.growthEvent.findFirst({ where: { userId: user.id, name: INVITE_DISMISSED }, select: { id: true } }));
}

/** Wording of the new design's onboarding and home invitation (option labels come with the options). */
export function onboardingCopy(lang: Lang) {
  const t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  return {
    welcome: t("خوش آمدید", "Welcome", "Willkommen", "Hoş geldiniz"),
    edit: t("شخصی‌سازی فضای کار", "Personalize your workspace", "Arbeitsbereich anpassen", "Çalışma alanını kişiselleştir"),
    steps: [
      { title: t("کدام شما را بهتر توصیف می‌کند؟", "Which best describes you?", "Was beschreibt Sie am besten?", "Sizi en iyi hangisi tanımlar?"), hint: t("یکی را انتخاب کنید.", "Pick one.", "Wählen Sie eines.", "Birini seçin.") },
      { title: t("می‌خواهید با هوش مصنوعی چه کارهایی انجام دهید؟", "What would you like to do with AI?", "Was möchten Sie mit KI erledigen?", "Yapay zekâ ile neler yapmak istiyorsunuz?"), hint: t("هر چند تا که می‌خواهید انتخاب کنید؛ اولی هدف اصلی شماست. همهٔ ابزارها همیشه در دسترس‌اند.", "Pick as many as you like; the first is your main goal. Every tool stays available.", "Wählen Sie beliebig viele; das erste ist Ihr Hauptziel. Alle Werkzeuge bleiben verfügbar.", "İstediğiniz kadar seçin; ilki ana hedefiniz. Tüm araçlar açık kalır.") },
      { title: t("الان مهم‌ترین کارتان چیست؟", "What matters most right now?", "Was ist Ihnen gerade am wichtigsten?", "Şu an sizin için en önemli olan ne?"), hint: t("یکی را انتخاب کنید.", "Pick one.", "Wählen Sie eines.", "Birini seçin.") },
      { title: t("پیشنهاد ما برای شروع", "Our suggestion to start", "Unser Vorschlag zum Start", "Başlangıç önerimiz"), hint: t("این‌ها فقط ترتیب صفحهٔ شما را تغییر می‌دهند؛ هیچ ابزاری بسته نمی‌شود.", "These only change what you see first; no tool is locked.", "Das ändert nur, was Sie zuerst sehen; kein Werkzeug wird gesperrt.", "Bunlar yalnızca önce ne gördüğünüzü değiştirir; hiçbir araç kilitlenmez.") },
    ],
    next: t("بعدی", "Next", "Weiter", "İleri"),
    back: t("قبلی", "Back", "Zurück", "Geri"),
    skip: t("فعلاً رد شو", "Skip for now", "Vorerst überspringen", "Şimdilik geç"),
    later: t("بعداً", "Later", "Später", "Sonra"),
    start: t("شروع با این ابزار", "Start with this tool", "Mit diesem Werkzeug starten", "Bu araçla başla"),
    home: t("رفتن به صفحهٔ اصلی", "Go to home", "Zur Startseite", "Ana sayfaya git"),
    firstTask: t("اولین قدم", "First task", "Erste Aufgabe", "İlk görev"),
    result: t("نتیجه", "What you'll get", "Ergebnis", "Sonuç"),
    credits: t("اعتبار شما: {n} — هزینهٔ هر کار پیش از اجرا در خود ابزار نمایش داده می‌شود.", "Your credits: {n} — each tool shows the cost before it runs.", "Ihre Credits: {n} — jedes Werkzeug zeigt die Kosten vor dem Start.", "Krediniz: {n} — her araç maliyeti çalışmadan önce gösterir."),
    error: t("ذخیره نشد؛ دوباره تلاش کنید.", "Could not save. Please try again.", "Speichern fehlgeschlagen. Bitte erneut versuchen.", "Kaydedilemedi. Tekrar deneyin."),
    invite: {
      title: t("فضای کارتان را شخصی کنید", "Make this workspace yours", "Machen Sie diesen Arbeitsbereich zu Ihrem", "Bu çalışma alanını kendinize göre ayarlayın"),
      body: t("سه سؤال کوتاه تا ابزارهای مناسب کارتان اول نمایش داده شوند. می‌توانید هر وقت خواستید تغییرش دهید.", "Three short questions so the tools that fit your work come first. You can change it any time.", "Drei kurze Fragen, damit die passenden Werkzeuge zuerst erscheinen. Jederzeit änderbar.", "İşinize uyan araçlar önce görünsün diye üç kısa soru. İstediğiniz zaman değiştirebilirsiniz."),
      start: t("شروع", "Start", "Starten", "Başla"),
      dismiss: t("نه، ممنون", "No thanks", "Nein danke", "Hayır, teşekkürler"),
    },
    personalize: t("شخصی‌سازی", "Personalize", "Anpassen", "Kişiselleştir"),
  };
}
export type OnboardingCopy = ReturnType<typeof onboardingCopy>;
