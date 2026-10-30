import type { Lang } from "@/lib/i18n";
import { supportAssistantName } from "./identity";

/** The floating support assistant's wording; shared by the classic widget and the new design. */
export const SUPPORT_WIDGET_COPY: Record<Lang, {
  title: string;
  launcherLabel: string;
  placeholder: string;
  greeting: string;
  starters: string[];
  unavailable: string;
  rateLimited: string;
  genericError: string;
  sourcesLabel: string;
  send: string;
  close: string;
  expand: string;
  collapse: string;
}> = {
  fa: {
    title: supportAssistantName("fa"),
    launcherLabel: "راهنمای AIFekr",
    placeholder: "سؤال خودتون رو بپرسید…",
    greeting: "سلام! هر سؤالی دربارهٔ پیدا کردن یا استفاده از بخش‌های AIFekr دارید، بپرسید.",
    starters: ["فاکتور رو از کجا پیدا کنم؟", "چطور اینستاگرامم رو وصل کنم؟", "کجا می‌تونم عکس بسازم؟"],
    unavailable: "دستیار پشتیبانی الان موقتاً در دسترس نیست — می‌تونید از همون چت اصلی هم بپرسید.",
    rateLimited: "کمی تند رفتید! چند لحظه صبر کنید و دوباره بپرسید.",
    genericError: "یه مشکلی پیش اومد — دوباره امتحان کنید.",
    sourcesLabel: "منبع",
    send: "ارسال",
    close: "بستن",
    expand: "تمام‌صفحه",
    collapse: "خروج از تمام‌صفحه",
  },
  en: {
    title: supportAssistantName("en"),
    launcherLabel: "AIFekr Guide",
    placeholder: "Ask anything…",
    greeting: "Hi! Ask me anything about finding or using a part of AIFekr.",
    starters: ["Where do I find invoices?", "How do I connect my Instagram?", "Where can I generate an image?"],
    unavailable: "The support assistant is temporarily unavailable — you can also ask the main chat.",
    rateLimited: "A bit fast! Wait a moment and ask again.",
    genericError: "Something went wrong — please try again.",
    sourcesLabel: "Source",
    send: "Send",
    close: "Close",
    expand: "Fullscreen",
    collapse: "Exit fullscreen",
  },
  de: {
    title: supportAssistantName("de"),
    launcherLabel: "AIFekr-Guide",
    placeholder: "Fragen Sie etwas…",
    greeting: "Hallo! Fragen Sie mich alles rund um das Finden oder Nutzen eines Bereichs von AIFekr.",
    starters: ["Wo finde ich Rechnungen?", "Wie verbinde ich mein Instagram?", "Wo kann ich ein Bild erstellen?"],
    unavailable: "Der Support-Assistent ist vorübergehend nicht verfügbar — Sie können auch den Hauptchat fragen.",
    rateLimited: "Etwas zu schnell! Warten Sie einen Moment und fragen Sie erneut.",
    genericError: "Etwas ist schiefgelaufen — bitte versuchen Sie es erneut.",
    sourcesLabel: "Quelle",
    send: "Senden",
    close: "Schließen",
    expand: "Vollbild",
    collapse: "Vollbild verlassen",
  },
  // No Turkish support-widget copy yet -- English fallback.
  tr: {
    title: supportAssistantName("tr"),
    launcherLabel: "AIFekr Guide",
    placeholder: "Ask anything…",
    greeting: "Hi! Ask me anything about finding or using a part of AIFekr.",
    starters: ["Where do I find invoices?", "How do I connect my Instagram?", "Where can I generate an image?"],
    unavailable: "The support assistant is temporarily unavailable — you can also ask the main chat.",
    rateLimited: "A bit fast! Wait a moment and ask again.",
    genericError: "Something went wrong — please try again.",
    sourcesLabel: "Source",
    send: "Send",
    close: "Close",
    expand: "Fullscreen",
    collapse: "Exit fullscreen",
  },
};
